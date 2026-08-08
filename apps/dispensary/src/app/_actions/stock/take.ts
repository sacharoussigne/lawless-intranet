'use server';

import { moveItemsWithChests as moveItemsWithChestsApi } from '@lawless-intranet/inventory-client/server';
import { actionErrorParser } from '@/lib/action';
import {
  inventoryActionError,
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

export type ChestStockMoveMode = 'take' | 'deposit';

export type ChestStockMoveItemInput = {
  itemId: string;
  quantity: number;
  chestId: string;
};

export async function moveItemsWithChests(
  dispensarySlug: string,
  data: {
    mode: ChestStockMoveMode;
    items: ChestStockMoveItemInput[];
  },
) {
  const isTake = data.mode === 'take';
  const actionLabel = isTake ? 'prendre' : 'déposer';

  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const userId = ctx.session.user.id;

    const validItems = data.items.filter((item) => item.quantity > 0 && item.chestId);
    if (validItems.length === 0) {
      return { status: 400, error: `Aucun objet à ${actionLabel}` };
    }

    await moveItemsWithChestsApi(
      {
        ...inventoryScope(dispensaryId),
        mode: data.mode,
        items: validItems,
        userId,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: { success: true, count: validItems.length, mode: data.mode },
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        isTake
          ? "Erreur lors de la prise d'objets"
          : "Erreur lors du dépôt d'objets",
      );
    } catch (e) {
      return actionErrorParser(
        e,
        isTake
          ? "Erreur lors de la prise d'objets"
          : "Erreur lors du dépôt d'objets",
      );
    }
  }
}

/** @deprecated Prefer moveItemsWithChests({ mode: 'take', ... }) */
export async function takeItemsFromChests(
  dispensarySlug: string,
  data: { items: ChestStockMoveItemInput[] },
) {
  return moveItemsWithChests(dispensarySlug, { mode: 'take', items: data.items });
}
