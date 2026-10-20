'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createCompany as createCompanyClient,
  deleteCompany as deleteCompanyClient,
  listCompanies,
  listCompaniesForSelect,
  updateCompany as updateCompanyClient,
} from '@lawless-intranet/inventory-client/server';

const companyGroupIdsSchema = z.array(z.string().uuid('ID de groupe invalide')).optional();

const bankAccountNumberSchema = z
  .string()
  .trim()
  .max(64, 'Le numéro de compte bancaire est trop long')
  .optional()
  .nullable();

const createCompanySchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  bankAccountNumber: bankAccountNumberSchema,
  companyGroupIds: companyGroupIdsSchema,
});

const updateCompanySchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  bankAccountNumber: bankAccountNumberSchema,
  companyGroupIds: companyGroupIdsSchema,
});

const deleteCompanySchema = z.object({
  id: z.string().uuid('ID invalide'),
});

async function createCompanyUnlogged(
  businessSlug: string,
  data: {
    name: string;
    bankAccountNumber?: string | null;
    companyGroupIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = createCompanySchema.parse(data);
    const company = await createCompanyClient(
      {
        ...inventoryScope(businessId),
        name: validatedData.name,
        bankAccountNumber: validatedData.bankAccountNumber?.trim() || null,
        companyGroupIds: validatedData.companyGroupIds,
      },
      await inventoryCookie(),
    );

    return { status: 201, data: company };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la création de l\'entreprise');
  }
}

export async function getCompaniesForSelect(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const companies = await listCompaniesForSelect(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    return { status: 200, data: companies };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des entreprises');
  }
}

export async function getCompanies(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const companies = await listCompanies(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    return { status: 200, data: companies };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des entreprises');
  }
}

async function updateCompanyUnlogged(
  businessSlug: string,
  data: {
    id: string;
    name: string;
    bankAccountNumber?: string | null;
    companyGroupIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = updateCompanySchema.parse(data);
    const company = await updateCompanyClient(
      {
        ...inventoryScope(businessId),
        id: validatedData.id,
        name: validatedData.name,
        bankAccountNumber: validatedData.bankAccountNumber?.trim() || null,
        companyGroupIds: validatedData.companyGroupIds ?? [],
      },
      await inventoryCookie(),
    );

    return { status: 200, data: company };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la modification de l\'entreprise');
  }
}

async function deleteCompanyUnlogged(businessSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = deleteCompanySchema.parse(data);
    await deleteCompanyClient(
      { ...inventoryScope(businessId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression de l\'entreprise');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createCompany(...args: Parameters<typeof createCompanyUnlogged>) {
  return loggedAction({ feature: 'management', event: 'companies.createCompany' }, args, () =>
    createCompanyUnlogged(...args),
  );
}

export async function updateCompany(...args: Parameters<typeof updateCompanyUnlogged>) {
  return loggedAction({ feature: 'management', event: 'companies.updateCompany' }, args, () =>
    updateCompanyUnlogged(...args),
  );
}

export async function deleteCompany(...args: Parameters<typeof deleteCompanyUnlogged>) {
  return loggedAction({ feature: 'management', event: 'companies.deleteCompany' }, args, () =>
    deleteCompanyUnlogged(...args),
  );
}
