'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { moveItemsWithChests as moveItemsWithChestsApi } from '@lawless-intranet/inventory-client/server';
import {
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

async function moveItemsWithChestsUnlogged(
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
    return serviceActionError(error, isTake
          ? "Erreur lors de la prise d'objets"
          : "Erreur lors du dépôt d'objets");
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function moveItemsWithChests(...args: Parameters<typeof moveItemsWithChestsUnlogged>) {
  return loggedAction({ feature: 'stock', event: 'take.moveItemsWithChests' }, args, () =>
    moveItemsWithChestsUnlogged(...args),
  );
}
