'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createCompanyGroup as createCompanyGroupClient,
  deleteCompanyGroup as deleteCompanyGroupClient,
  listCompanyGroups,
  listCompanyGroupsForOrders,
  listCompanyGroupsForSelect,
  updateCompanyGroup as updateCompanyGroupClient,
} from '@lawless-intranet/inventory-client/server';

const createCompanyGroupSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  companyIds: z.array(z.string().uuid('ID d\'entreprise invalide')).optional(),
});

const updateCompanyGroupSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  companyIds: z.array(z.string().uuid('ID d\'entreprise invalide')).optional(),
});

const deleteCompanyGroupSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

export async function createCompanyGroup(
  dispensarySlug: string,
  data: {
    name: string;
    description?: string;
    companyIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createCompanyGroupSchema.parse(data);
    const companyGroup = await createCompanyGroupClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 201, data: companyGroup };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création du groupe d\'entreprises');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création du groupe d\'entreprises');
    }
  }
}

export async function getCompanyGroupsForSelect(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const companyGroups = await listCompanyGroupsForSelect(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: companyGroups };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des groupes d\'entreprises');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des groupes d\'entreprises');
    }
  }
}

export async function getCompanyGroupsForOrders(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const companyGroups = await listCompanyGroupsForOrders(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: companyGroups };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des groupes d\'entreprises');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des groupes d\'entreprises');
    }
  }
}

export async function getCompanyGroups(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const companyGroups = await listCompanyGroups(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: companyGroups };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des groupes d\'entreprises');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des groupes d\'entreprises');
    }
  }
}

export async function updateCompanyGroup(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    companyIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateCompanyGroupSchema.parse(data);
    const companyGroup = await updateCompanyGroupClient(
      {
        ...inventoryScope(dispensaryId),
        id: validatedData.id,
        name: validatedData.name,
        description: validatedData.description,
        companyIds: validatedData.companyIds ?? [],
      },
      await inventoryCookie(),
    );

    return { status: 200, data: companyGroup };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la modification du groupe d\'entreprises');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification du groupe d\'entreprises');
    }
  }
}

export async function deleteCompanyGroup(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteCompanyGroupSchema.parse(data);
    await deleteCompanyGroupClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la suppression du groupe d\'entreprises');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression du groupe d\'entreprises');
    }
  }
}
