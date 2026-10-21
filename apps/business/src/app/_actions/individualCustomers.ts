'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
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
  businessSlug: string,
  query: string,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      permission: {
        resource: 'sales',
        action: 'create',
        message: 'Permission refusée',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { status: 200, data: [] as Array<{ id: string; name: string }> };
    }

    const customers = await searchCustomers(
      { ...inventoryScope(businessId), q: trimmed },
      await inventoryCookie(),
    );

    return { status: 200, data: customers };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la recherche de clients');
  }
}

export async function getIndividualCustomers(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'orders',
      permission: { resource: 'orders', action: 'view' },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const customers = await listCustomers(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    return { status: 200, data: customers };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des particuliers');
  }
}

async function createIndividualCustomerUnlogged(
  businessSlug: string,
  data: { name: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'orders',
      permission: { resource: 'orders', action: 'create' },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validated = createIndividualCustomerSchema.parse(data);
    const customer = await createCustomer(
      { ...inventoryScope(businessId), name: validated.name },
      await inventoryCookie(),
    );

    return { status: 201, data: customer };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la création du particulier');
  }
}

async function deleteIndividualCustomerByNameUnlogged(
  businessSlug: string,
  data: { name: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'orders',
      permission: { resource: 'orders', action: 'delete' },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validated = deleteIndividualCustomerByNameSchema.parse(data);
    await deleteCustomerByName(
      { ...inventoryScope(businessId), name: validated.name.trim() },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression du particulier');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createIndividualCustomer(
  ...args: Parameters<typeof createIndividualCustomerUnlogged>
) {
  return loggedAction(
    { feature: 'orders', event: 'individualCustomers.createIndividualCustomer' },
    args,
    () => createIndividualCustomerUnlogged(...args),
  );
}

export async function deleteIndividualCustomerByName(
  ...args: Parameters<typeof deleteIndividualCustomerByNameUnlogged>
) {
  return loggedAction(
    { feature: 'orders', event: 'individualCustomers.deleteIndividualCustomerByName' },
    args,
    () => deleteIndividualCustomerByNameUnlogged(...args),
  );
}
