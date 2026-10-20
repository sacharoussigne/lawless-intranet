'use server';

import { withStockChange } from '@/lib/stock/realtime/broadcast';
import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createChest as createChestClient,
  deleteChest as deleteChestClient,
  listChests,
  listChestsLite,
  reorderChests as reorderChestsClient,
  updateChest as updateChestClient,
} from '@lawless-intranet/inventory-client/server';
import type { ChestRecord } from '@lawless-intranet/types';

const createChestSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  isEnabled: z.boolean().default(true),
});

const updateChestSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  isEnabled: z.boolean(),
});

const deleteChestSchema = z.object({
  id: z.string().uuid('ID invalide'),
  targetChestId: z.string().uuid('ID de coffre de destination invalide'),
});

const reorderChestsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid('ID invalide'),
    order: z.number().int(),
  })),
});

export type GetChestsListOptions = {
  bypassAccessFilter?: boolean;
};

async function createChestUnlogged(
  businessSlug: string,
  data: {
    name: string;
    description?: string;
    isEnabled?: boolean;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = createChestSchema.parse(data);
    const chest = await createChestClient(
      { ...inventoryScope(businessId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 201, data: chest };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la création du coffre');
  }
}

export async function getChests(businessSlug: string, onlyEnabled: boolean = false) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const chests = (await listChests(
      {
        ...inventoryScope(businessId),
        onlyEnabled: onlyEnabled || undefined,
      },
      await inventoryCookie(),
    )) as ChestRecord[];

    return { status: 200, data: chests };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des coffres');
  }
}

export async function getChestsList(
  businessSlug: string,
  onlyEnabled: boolean = false,
  options: GetChestsListOptions = {},
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const chests = await listChestsLite(
      {
        ...inventoryScope(businessId),
        onlyEnabled: onlyEnabled || undefined,
        effectiveRole,
        bypassAccessFilter: options.bypassAccessFilter || undefined,
      },
      await inventoryCookie(),
    );

    return { status: 200, data: chests };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des coffres');
  }
}

async function updateChestUnlogged(
  businessSlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    isEnabled?: boolean;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = updateChestSchema.parse(data);
    const chest = await updateChestClient(
      { ...inventoryScope(businessId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: chest };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la modification du coffre');
  }
}

async function deleteChestUnlogged(
  businessSlug: string,
  data: { id: string; targetChestId: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = deleteChestSchema.parse(data);
    await deleteChestClient(
      { ...inventoryScope(businessId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression du coffre');
  }
}

async function reorderChestsUnlogged(
  businessSlug: string,
  data: { items: { id: string; order: number }[] },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = reorderChestsSchema.parse(data);
    await reorderChestsClient(
      { ...inventoryScope(businessId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du réordonnancement des coffres');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createChest(...args: Parameters<typeof createChestUnlogged>) {
  return withStockChange(
    args[0],
    () =>
      loggedAction({ feature: 'management', event: 'chests.createChest' }, args, () =>
        createChestUnlogged(...args),
      ),
  );
}

export async function updateChest(...args: Parameters<typeof updateChestUnlogged>) {
  return withStockChange(
    args[0],
    () =>
      loggedAction({ feature: 'management', event: 'chests.updateChest' }, args, () =>
        updateChestUnlogged(...args),
      ),
  );
}

export async function deleteChest(...args: Parameters<typeof deleteChestUnlogged>) {
  return withStockChange(
    args[0],
    () =>
      loggedAction({ feature: 'management', event: 'chests.deleteChest' }, args, () =>
        deleteChestUnlogged(...args),
      ),
  );
}

export async function reorderChests(...args: Parameters<typeof reorderChestsUnlogged>) {
  return withStockChange(
    args[0],
    () =>
      loggedAction({ feature: 'management', event: 'chests.reorderChests' }, args, () =>
        reorderChestsUnlogged(...args),
      ),
  );
}
