'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
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

async function createCompanyGroupUnlogged(
  businessSlug: string,
  data: {
    name: string;
    description?: string;
    companyIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = createCompanyGroupSchema.parse(data);
    const companyGroup = await createCompanyGroupClient(
      { ...inventoryScope(businessId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 201, data: companyGroup };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la création du groupe d\'entreprises');
  }
}

export async function getCompanyGroupsForSelect(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const companyGroups = await listCompanyGroupsForSelect(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    return { status: 200, data: companyGroups };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des groupes d\'entreprises');
  }
}

export async function getCompanyGroupsForOrders(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const companyGroups = await listCompanyGroupsForOrders(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    return { status: 200, data: companyGroups };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des groupes d\'entreprises');
  }
}

export async function getCompanyGroups(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const companyGroups = await listCompanyGroups(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    return { status: 200, data: companyGroups };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des groupes d\'entreprises');
  }
}

async function updateCompanyGroupUnlogged(
  businessSlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    companyIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = updateCompanyGroupSchema.parse(data);
    const companyGroup = await updateCompanyGroupClient(
      {
        ...inventoryScope(businessId),
        id: validatedData.id,
        name: validatedData.name,
        description: validatedData.description,
        companyIds: validatedData.companyIds ?? [],
      },
      await inventoryCookie(),
    );

    return { status: 200, data: companyGroup };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la modification du groupe d\'entreprises');
  }
}

async function deleteCompanyGroupUnlogged(businessSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = deleteCompanyGroupSchema.parse(data);
    await deleteCompanyGroupClient(
      { ...inventoryScope(businessId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression du groupe d\'entreprises');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createCompanyGroup(...args: Parameters<typeof createCompanyGroupUnlogged>) {
  return loggedAction(
    { feature: 'management', event: 'companyGroups.createCompanyGroup' },
    args,
    () => createCompanyGroupUnlogged(...args),
  );
}

export async function updateCompanyGroup(...args: Parameters<typeof updateCompanyGroupUnlogged>) {
  return loggedAction(
    { feature: 'management', event: 'companyGroups.updateCompanyGroup' },
    args,
    () => updateCompanyGroupUnlogged(...args),
  );
}

export async function deleteCompanyGroup(...args: Parameters<typeof deleteCompanyGroupUnlogged>) {
  return loggedAction(
    { feature: 'management', event: 'companyGroups.deleteCompanyGroup' },
    args,
    () => deleteCompanyGroupUnlogged(...args),
  );
}
