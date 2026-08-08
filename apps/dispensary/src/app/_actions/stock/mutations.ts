'use server';

import {
  craftItem as craftItemApi,
  overwriteStockForDate as overwriteStockForDateApi,
  updateStock as updateStockApi,
} from '@lawless-intranet/inventory-client/server';
import { actionErrorParser } from '@/lib/action';
import {
  inventoryActionError,
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

export async function updateStock(
  dispensarySlug: string,
  data: { itemId: string; quantity: number }[],
  chestId?: string | null,
  options?: { skipHistory?: boolean },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de mettre à jour le stock",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const { session } = ctx;

    if (data.length === 0) {
      return { status: 200, data: [] };
    }

    const results = await updateStockApi(
      {
        ...inventoryScope(dispensaryId),
        stocks: data,
        chestId,
        skipHistory: options?.skipHistory ?? false,
        userId: session.user.id,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return { status: 200, data: results };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la mise à jour du stock');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la mise à jour du stock');
    }
  }
}

export async function craftItem(
  dispensarySlug: string,
  data: {
    craftedItemId: string;
    recipeId: string;
    times: number;
    sourceChestId: string | null;
    ingredientChests: { ingredientId: string; chestId: string }[];
    destinationChestId: string | null;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'craft-write',
        message:
          "Permission refusée : vous n'avez pas la permission d'effectuer un craft",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const { session } = ctx;

    const result = await craftItemApi(
      {
        ...inventoryScope(dispensaryId),
        craftedItemId: data.craftedItemId,
        recipeId: data.recipeId,
        times: data.times,
        sourceChestId: data.sourceChestId,
        ingredientChests: data.ingredientChests,
        destinationChestId: data.destinationChestId,
        userId: session.user.id,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return { status: 200, data: result };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors du craft');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du craft');
    }
  }
}

export async function overwriteStockForDate(
  dispensarySlug: string,
  data: {
    date: Date;
    stocks: { itemId: string; quantity: number }[];
    chestId?: string | null;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const result = await overwriteStockForDateApi(
      {
        ...inventoryScope(dispensaryId),
        date: data.date,
        stocks: data.stocks,
        chestId: data.chestId,
      },
      await inventoryCookie(),
    );

    return { status: 200, data: result };
  } catch (error) {
    try {
      return inventoryActionError(error, "Erreur lors de l'écrasement des stocks");
    } catch (e) {
      return actionErrorParser(e, "Erreur lors de l'écrasement des stocks");
    }
  }
}
