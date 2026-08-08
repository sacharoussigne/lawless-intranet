'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createCustomer,
  deleteCustomerByName,
  listCustomers,
  searchCustomers,
} from '@lawless-intranet/inventory-client/server';

const createIndividualCustomerSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
});

const deleteIndividualCustomerByNameSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function searchIndividualCustomers(
  dispensarySlug: string,
  query: string,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: {
        resource: 'sales',
        action: 'create',
        message: 'Permission refusée',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { status: 200, data: [] as Array<{ id: string; name: string }> };
    }

    const customers = await searchCustomers(
      { ...inventoryScope(dispensaryId), q: trimmed },
      await inventoryCookie(),
    );

    return { status: 200, data: customers };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la recherche de clients');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la recherche de clients');
    }
  }
}

export async function getIndividualCustomers(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'orders',
      permission: { resource: 'orders', action: 'view' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const customers = await listCustomers(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: customers };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des particuliers');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des particuliers');
    }
  }
}

export async function createIndividualCustomer(
  dispensarySlug: string,
  data: { name: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'orders',
      permission: { resource: 'orders', action: 'create' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = createIndividualCustomerSchema.parse(data);
    const customer = await createCustomer(
      { ...inventoryScope(dispensaryId), name: validated.name },
      await inventoryCookie(),
    );

    return { status: 201, data: customer };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création du particulier');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création du particulier');
    }
  }
}

export async function deleteIndividualCustomerByName(
  dispensarySlug: string,
  data: { name: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'orders',
      permission: { resource: 'orders', action: 'delete' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = deleteIndividualCustomerByNameSchema.parse(data);
    await deleteCustomerByName(
      { ...inventoryScope(dispensaryId), name: validated.name.trim() },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la suppression du particulier');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression du particulier');
    }
  }
}
