'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { loggedAction } from '@/lib/logs/writer';
import { appSettingsCacheTag } from '@/lib/appSettings';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { PAYROLL_MAX_USD } from '@/lib/payroll/constants';
import { listPayrollSalaryTypes } from '@/lib/payroll/salaryTypes';
import { businessBase } from '@/types/routes';

const usdSchema = z
  .number({ invalid_type_error: 'Montant invalide' })
  .min(0.01, 'Le montant doit être d’au moins 0,01 $')
  .max(PAYROLL_MAX_USD, 'Montant trop élevé');

const salaryTypeSchema = z.object({
  label: z.string().trim().min(1, 'Le libellé est requis').max(60, 'Le libellé est trop long'),
  caisseUnitUsd: usdSchema,
  isDefault: z.boolean(),
});

const updateSalaryTypeSchema = salaryTypeSchema.extend({ id: z.string().min(1) });

const patientCareSchema = z.object({ patientCareUsd: usdSchema });

const DUPLICATE_LABEL_MESSAGE = 'Un type de salaire porte déjà ce libellé.';

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

export async function listPayrollSalaryTypesForAdmin(businessSlug: string) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) return { status: auth.status, error: auth.error };
    return { status: 200 as const, data: await listPayrollSalaryTypes(auth.ctx.businessId) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des salaires');
  }
}

async function createPayrollSalaryTypeUnlogged(businessSlug: string, input: unknown) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) return { status: auth.status, error: auth.error };
    const { businessId } = auth.ctx;
    const parsed = salaryTypeSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
    }

    const count = await prisma.payrollSalaryType.count({ where: tenantWhere(businessId) });
    // The first salary type is the default one.
    const isDefault = parsed.data.isDefault || count === 0;
    await prisma.$transaction([
      ...(isDefault
        ? [prisma.payrollSalaryType.updateMany({ where: tenantWhere(businessId), data: { isDefault: false } })]
        : []),
      prisma.payrollSalaryType.create({
        data: { businessId, ...parsed.data, isDefault, sortOrder: count },
      }),
    ]);

    return { status: 200 as const, data: await listPayrollSalaryTypes(businessId) };
  } catch (error) {
    if (isUniqueViolation(error)) return { status: 409, error: DUPLICATE_LABEL_MESSAGE };
    return actionErrorParser(error, 'Erreur lors de l’ajout du salaire');
  }
}

async function updatePayrollSalaryTypeUnlogged(businessSlug: string, input: unknown) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) return { status: auth.status, error: auth.error };
    const { businessId } = auth.ctx;
    const parsed = updateSalaryTypeSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
    }
    const { id, ...data } = parsed.data;

    const existing = await prisma.payrollSalaryType.findFirst({
      where: { id, ...tenantWhere(businessId) },
      select: { isDefault: true },
    });
    if (!existing) return { status: 404, error: 'Type de salaire introuvable' };
    // The default one stays the default until another one takes its place.
    const isDefault = data.isDefault || existing.isDefault;

    await prisma.$transaction([
      ...(isDefault
        ? [
            prisma.payrollSalaryType.updateMany({
              where: { ...tenantWhere(businessId), id: { not: id } },
              data: { isDefault: false },
            }),
          ]
        : []),
      prisma.payrollSalaryType.update({ where: { id }, data: { ...data, isDefault } }),
    ]);

    return { status: 200 as const, data: await listPayrollSalaryTypes(businessId) };
  } catch (error) {
    if (isUniqueViolation(error)) return { status: 409, error: DUPLICATE_LABEL_MESSAGE };
    return actionErrorParser(error, 'Erreur lors de la modification du salaire');
  }
}

async function deletePayrollSalaryTypeUnlogged(businessSlug: string, id: string) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) return { status: auth.status, error: auth.error };
    const { businessId } = auth.ctx;

    const existing = await prisma.payrollSalaryType.findFirst({
      where: { id, ...tenantWhere(businessId) },
      select: { isDefault: true },
    });
    if (!existing) return { status: 404, error: 'Type de salaire introuvable' };

    // Its people go back to the default salary type (onDelete: SetNull).
    await prisma.payrollSalaryType.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await prisma.payrollSalaryType.findFirst({
        where: tenantWhere(businessId),
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (next) {
        await prisma.payrollSalaryType.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return { status: 200 as const, data: await listPayrollSalaryTypes(businessId) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du salaire');
  }
}

async function updatePayrollPatientCareUnlogged(businessSlug: string, input: unknown) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) return { status: auth.status, error: auth.error };
    const { businessId, business } = auth.ctx;
    const parsed = patientCareSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
    }

    const row = await prisma.appSettings.upsert({
      where: { businessId },
      create: { businessId, businessName: business.name, payrollPatientCareUsd: parsed.data.patientCareUsd },
      update: { payrollPatientCareUsd: parsed.data.patientCareUsd },
      select: { payrollPatientCareUsd: true },
    });
    updateTag(appSettingsCacheTag(businessId));
    revalidatePath(businessBase(business.slug), 'layout');

    return { status: 200 as const, data: { patientCareUsd: Number(row.payrollPatientCareUsd) } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du tarif patient');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createPayrollSalaryType(
  ...args: Parameters<typeof createPayrollSalaryTypeUnlogged>
) {
  return loggedAction({ feature: 'payroll', event: 'salaryTypes.createSalaryType' }, args, () =>
    createPayrollSalaryTypeUnlogged(...args),
  );
}

export async function updatePayrollSalaryType(
  ...args: Parameters<typeof updatePayrollSalaryTypeUnlogged>
) {
  return loggedAction({ feature: 'payroll', event: 'salaryTypes.updateSalaryType' }, args, () =>
    updatePayrollSalaryTypeUnlogged(...args),
  );
}

export async function deletePayrollSalaryType(
  ...args: Parameters<typeof deletePayrollSalaryTypeUnlogged>
) {
  return loggedAction({ feature: 'payroll', event: 'salaryTypes.deleteSalaryType' }, args, () =>
    deletePayrollSalaryTypeUnlogged(...args),
  );
}

export async function updatePayrollPatientCare(
  ...args: Parameters<typeof updatePayrollPatientCareUnlogged>
) {
  return loggedAction({ feature: 'payroll', event: 'salaryTypes.updatePatientCare' }, args, () =>
    updatePayrollPatientCareUnlogged(...args),
  );
}
