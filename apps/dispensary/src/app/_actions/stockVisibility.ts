'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  getChestStockVisibility as getChestStockVisibilityClient,
  setChestCategoryHidden as setChestCategoryHiddenClient,
  setChestItemHidden as setChestItemHiddenClient,
} from '@lawless-intranet/inventory-client/server';
import type { ChestStockVisibilityRecord } from '@lawless-intranet/types';

const chestIdSchema = z.string().uuid('ID de coffre invalide');
const categoryIdSchema = z.string().uuid('ID de catégorie invalide');
const itemIdSchema = z.string().uuid('ID d\'objet invalide');

const setHiddenSchema = z.object({
  chestId: chestIdSchema,
  hidden: z.boolean(),
});

export async function getChestStockVisibility(
  dispensarySlug: string,
  chestId: string,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: { resource: 'stock', action: 'view' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const parsedChestId = chestIdSchema.parse(chestId);
    const data = await getChestStockVisibilityClient(
      { ...inventoryScope(dispensaryId), chestId: parsedChestId },
      await inventoryCookie(),
    ) as ChestStockVisibilityRecord;

    return { status: 200, data };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du chargement de la visibilité du stock');
  }
}

async function setChestCategoryHiddenUnlogged(
  dispensarySlug: string,
  input: { chestId: string; categoryId: string; hidden: boolean },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'hide',
        message: 'Permission refusée : vous n\'avez pas la permission de masquer des éléments du stock',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = setHiddenSchema.extend({ categoryId: categoryIdSchema }).parse(input);
    await setChestCategoryHiddenClient(
      { ...inventoryScope(dispensaryId), ...validated },
      await inventoryCookie(),
    );

    return { status: 200, data: { ok: true as const } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la mise à jour de la visibilité de la catégorie');
  }
}

async function setChestItemHiddenUnlogged(
  dispensarySlug: string,
  input: { chestId: string; itemId: string; hidden: boolean },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'hide',
        message: 'Permission refusée : vous n\'avez pas la permission de masquer des éléments du stock',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = setHiddenSchema.extend({ itemId: itemIdSchema }).parse(input);
    await setChestItemHiddenClient(
      { ...inventoryScope(dispensaryId), ...validated },
      await inventoryCookie(),
    );

    return { status: 200, data: { ok: true as const } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la mise à jour de la visibilité de l\'objet');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function setChestCategoryHidden(
  ...args: Parameters<typeof setChestCategoryHiddenUnlogged>
) {
  return loggedAction(
    { feature: 'stock', event: 'stockVisibility.setChestCategoryHidden' },
    args,
    () => setChestCategoryHiddenUnlogged(...args),
  );
}

export async function setChestItemHidden(...args: Parameters<typeof setChestItemHiddenUnlogged>) {
  return loggedAction({ feature: 'stock', event: 'stockVisibility.setChestItemHidden' }, args, () =>
    setChestItemHiddenUnlogged(...args),
  );
}
