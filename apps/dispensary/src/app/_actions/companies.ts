'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
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

export async function createCompany(
  dispensarySlug: string,
  data: {
    name: string;
    bankAccountNumber?: string | null;
    companyGroupIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createCompanySchema.parse(data);
    const company = await createCompanyClient(
      {
        ...inventoryScope(dispensaryId),
        name: validatedData.name,
        bankAccountNumber: validatedData.bankAccountNumber?.trim() || null,
        companyGroupIds: validatedData.companyGroupIds,
      },
      await inventoryCookie(),
    );

    return { status: 201, data: company };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création de l\'entreprise');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de l\'entreprise');
    }
  }
}

export async function getCompaniesForSelect(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const companies = await listCompaniesForSelect(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: companies };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des entreprises');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des entreprises');
    }
  }
}

export async function getCompanies(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const companies = await listCompanies(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: companies };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des entreprises');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des entreprises');
    }
  }
}

export async function updateCompany(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    bankAccountNumber?: string | null;
    companyGroupIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateCompanySchema.parse(data);
    const company = await updateCompanyClient(
      {
        ...inventoryScope(dispensaryId),
        id: validatedData.id,
        name: validatedData.name,
        bankAccountNumber: validatedData.bankAccountNumber?.trim() || null,
        companyGroupIds: validatedData.companyGroupIds ?? [],
      },
      await inventoryCookie(),
    );

    return { status: 200, data: company };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la modification de l\'entreprise');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification de l\'entreprise');
    }
  }
}

export async function deleteCompany(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteCompanySchema.parse(data);
    await deleteCompanyClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la suppression de l\'entreprise');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de l\'entreprise');
    }
  }
}
