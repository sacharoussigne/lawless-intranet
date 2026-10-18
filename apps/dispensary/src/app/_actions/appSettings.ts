'use server';

import { loggedAction } from '@/lib/logs/writer';
import { revalidatePath } from 'next/cache';
import { updateTag } from 'next/cache';
import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import {
  appSettingsCacheTag,
  getAppSettings,
  type AppSettingsDTO,
} from '@/lib/appSettings';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';

export type BusinessSettingsAdminDTO = AppSettingsDTO & {
  slug: string;
};

const slugSchema = z
  .string()
  .trim()
  .min(1, 'Le slug est requis')
  .max(80, 'Le slug est trop long')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide (lettres minuscules, chiffres et tirets)');

const updateSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(120, 'Le nom est trop long'),
  slug: slugSchema,
  featureStockEnabled: z.boolean(),
  featureBankEnabled: z.boolean(),
  featureOrdersEnabled: z.boolean(),
  featureSearchEnabled: z.boolean(),
  featureMailsEnabled: z.boolean(),
  featurePayrollEnabled: z.boolean(),
  featureWeeklyDispensaryActivityEnabled: z.boolean(),
  featureAgendaEnabled: z.boolean(),
  featureCabinetEnabled: z.boolean(),
  featureSalesEnabled: z.boolean(),
  featureMediaEnabled: z.boolean(),
  weeklyActivityChestDaysVisible: z.boolean(),
  weeklyActivityPresenceDaysVisible: z.boolean(),
  weeklyActivityPatientsVisible: z.boolean(),
  weeklyActivitySherifsVisible: z.boolean(),
  weeklyActivityInfusionsVisible: z.boolean(),
  weeklyActivityPoppyMilkVisible: z.boolean(),
});

export async function getAppSettingsForAdmin(
  businessSlug: string,
): Promise<
  | { status: 200; data: BusinessSettingsAdminDTO }
  | { status: number; error: string }
> {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const settings = await getAppSettings(auth.ctx.businessId);
    const data: BusinessSettingsAdminDTO = {
      ...settings,
      slug: auth.ctx.business.slug,
    };
    return { status: 200, data };
  } catch (error) {
    const parsed = actionErrorParser(
      error,
      'Erreur lors du chargement des paramètres',
    );
    return {
      status: 500,
      error:
        typeof parsed.error === 'string'
          ? parsed.error
          : 'Erreur lors du chargement des paramètres',
    };
  }
}

async function updateAppSettingsUnlogged(
  businessSlug: string,
  input: z.infer<typeof updateSchema>,
): Promise<
  | { status: 200; data: BusinessSettingsAdminDTO }
  | { status: number; error: string }
> {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }
    const { businessId, business } = auth.ctx;

    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 400,
        error: parsed.error.issues[0]?.message ?? 'Données invalides',
      };
    }

    const newSlug = parsed.data.slug;
    if (newSlug !== business.slug) {
      const taken = await prisma.business.findFirst({
        where: { slug: newSlug, id: { not: businessId } },
        select: { id: true },
      });
      if (taken) {
        return { status: 409, error: 'Ce slug est déjà utilisé par un autre dispensaire' };
      }
    }

    const [, row] = await prisma.$transaction([
      prisma.business.update({
        where: { id: businessId },
        data: {
          name: parsed.data.businessName,
          slug: newSlug,
        },
      }),
      prisma.appSettings.upsert({
        where: { businessId },
        create: {
          businessId,
          businessName: parsed.data.businessName,
          featureStockEnabled: parsed.data.featureStockEnabled,
          featureBankEnabled: parsed.data.featureBankEnabled,
          featureOrdersEnabled: parsed.data.featureOrdersEnabled,
          featureSearchEnabled: parsed.data.featureSearchEnabled,
          featureMailsEnabled: parsed.data.featureMailsEnabled,
          featurePayrollEnabled: parsed.data.featurePayrollEnabled,
          featureWeeklyDispensaryActivityEnabled:
            parsed.data.featureWeeklyDispensaryActivityEnabled,
          featureAgendaEnabled: parsed.data.featureAgendaEnabled,
          featureCabinetEnabled: parsed.data.featureCabinetEnabled,
          featureSalesEnabled: parsed.data.featureSalesEnabled,
          featureMediaEnabled: parsed.data.featureMediaEnabled,
          weeklyActivityChestDaysVisible: parsed.data.weeklyActivityChestDaysVisible,
          weeklyActivityPresenceDaysVisible: parsed.data.weeklyActivityPresenceDaysVisible,
          weeklyActivityPatientsVisible: parsed.data.weeklyActivityPatientsVisible,
          weeklyActivitySherifsVisible: parsed.data.weeklyActivitySherifsVisible,
          weeklyActivityInfusionsVisible: parsed.data.weeklyActivityInfusionsVisible,
          weeklyActivityPoppyMilkVisible: parsed.data.weeklyActivityPoppyMilkVisible,
        },
        update: {
          businessName: parsed.data.businessName,
          featureStockEnabled: parsed.data.featureStockEnabled,
          featureBankEnabled: parsed.data.featureBankEnabled,
          featureOrdersEnabled: parsed.data.featureOrdersEnabled,
          featureSearchEnabled: parsed.data.featureSearchEnabled,
          featureMailsEnabled: parsed.data.featureMailsEnabled,
          featurePayrollEnabled: parsed.data.featurePayrollEnabled,
          featureWeeklyDispensaryActivityEnabled:
            parsed.data.featureWeeklyDispensaryActivityEnabled,
          featureAgendaEnabled: parsed.data.featureAgendaEnabled,
          featureCabinetEnabled: parsed.data.featureCabinetEnabled,
          featureSalesEnabled: parsed.data.featureSalesEnabled,
          featureMediaEnabled: parsed.data.featureMediaEnabled,
          weeklyActivityChestDaysVisible: parsed.data.weeklyActivityChestDaysVisible,
          weeklyActivityPresenceDaysVisible: parsed.data.weeklyActivityPresenceDaysVisible,
          weeklyActivityPatientsVisible: parsed.data.weeklyActivityPatientsVisible,
          weeklyActivitySherifsVisible: parsed.data.weeklyActivitySherifsVisible,
          weeklyActivityInfusionsVisible: parsed.data.weeklyActivityInfusionsVisible,
          weeklyActivityPoppyMilkVisible: parsed.data.weeklyActivityPoppyMilkVisible,
        },
      }),
    ]);

    updateTag(appSettingsCacheTag(businessId));
    revalidatePath(`/d/${business.slug}`, 'layout');
    if (newSlug !== business.slug) {
      revalidatePath(`/d/${newSlug}`, 'layout');
    }
    revalidatePath('/platform/dispensaries');

    const data: BusinessSettingsAdminDTO = {
      businessType: business.type,
      businessName: row.businessName,
      slug: newSlug,
      featureStockEnabled: row.featureStockEnabled,
      featureBankEnabled: row.featureBankEnabled,
      featureOrdersEnabled: row.featureOrdersEnabled,
      featureSearchEnabled: row.featureSearchEnabled,
      featureMailsEnabled: row.featureMailsEnabled,
      featurePayrollEnabled: row.featurePayrollEnabled,
      featureWeeklyDispensaryActivityEnabled: row.featureWeeklyDispensaryActivityEnabled,
      featureAgendaEnabled: row.featureAgendaEnabled ?? true,
      featureCabinetEnabled: row.featureCabinetEnabled ?? true,
      featureSalesEnabled: row.featureSalesEnabled ?? true,
      featureMediaEnabled: row.featureMediaEnabled ?? true,
      weeklyActivityChestDaysVisible: row.weeklyActivityChestDaysVisible ?? true,
      weeklyActivityPresenceDaysVisible: row.weeklyActivityPresenceDaysVisible ?? true,
      weeklyActivityPatientsVisible: row.weeklyActivityPatientsVisible ?? true,
      weeklyActivitySherifsVisible: row.weeklyActivitySherifsVisible ?? true,
      weeklyActivityInfusionsVisible: row.weeklyActivityInfusionsVisible ?? true,
      weeklyActivityPoppyMilkVisible: row.weeklyActivityPoppyMilkVisible ?? true,
    };

    return { status: 200, data };
  } catch (error) {
    const parsed = actionErrorParser(
      error,
      'Erreur lors de la mise à jour des paramètres',
    );
    return {
      status: 500,
      error:
        typeof parsed.error === 'string'
          ? parsed.error
          : 'Erreur lors de la mise à jour des paramètres',
    };
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function updateAppSettings(...args: Parameters<typeof updateAppSettingsUnlogged>) {
  return loggedAction({ feature: 'settings', event: 'appSettings.updateAppSettings' }, args, () =>
    updateAppSettingsUnlogged(...args),
  );
}
