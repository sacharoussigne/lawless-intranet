'use server';

import { withStockChange } from '@/lib/stock/realtime/broadcast';
import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import {
  craftItem as craftItemApi,
  overwriteStockForDate as overwriteStockForDateApi,
  updateStock as updateStockApi,
} from '@lawless-intranet/inventory-client/server';
import {
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

async function updateStockUnlogged(
  businessSlug: string,
  data: { itemId: string; quantity: number }[],
  chestId?: string | null,
  options?: { skipHistory?: boolean },
  /** Realtime meta of the client: no echo of the change to its author. */
  _meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de mettre à jour le stock",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;
    const { session } = ctx;

    if (data.length === 0) {
      return { status: 200, data: [] };
    }

    const results = await updateStockApi(
      {
        ...inventoryScope(businessId),
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
    return serviceActionError(error, 'Erreur lors de la mise à jour du stock');
  }
}

async function craftItemUnlogged(
  businessSlug: string,
  data: {
    craftedItemId: string;
    recipeId: string;
    times: number;
    sourceChestId: string | null;
    ingredientChests: { ingredientId: string; chestId: string }[];
    destinationChestId: string | null;
  },
  /** Realtime meta of the client: no echo of the change to its author. */
  _meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'craft-write',
        message:
          "Permission refusée : vous n'avez pas la permission d'effectuer un craft",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;
    const { session } = ctx;

    const result = await craftItemApi(
      {
        ...inventoryScope(businessId),
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
    return serviceActionError(error, 'Erreur lors du craft');
  }
}

async function overwriteStockForDateUnlogged(
  businessSlug: string,
  data: {
    date: Date;
    stocks: { itemId: string; quantity: number }[];
    chestId?: string | null;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const result = await overwriteStockForDateApi(
      {
        ...inventoryScope(businessId),
        date: data.date,
        stocks: data.stocks,
        chestId: data.chestId,
      },
      await inventoryCookie(),
    );

    return { status: 200, data: result };
  } catch (error) {
    return serviceActionError(error, "Erreur lors de l'écrasement des stocks");
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function updateStock(...args: Parameters<typeof updateStockUnlogged>) {
  return withStockChange(
    args[0],
    () =>
      loggedAction(
        {
          feature: 'stock',
          event: 'mutations.updateStock',
          target: ([, , chestId]) => chestId,
        },
        args,
        () => updateStockUnlogged(...args),
      ),
    args[4],
  );
}

export async function craftItem(...args: Parameters<typeof craftItemUnlogged>) {
  return withStockChange(
    args[0],
    () =>
      loggedAction(
        {
          feature: 'stock',
          event: 'mutations.craftItem',
          target: ([, data]) => data.recipeId,
        },
        args,
        () => craftItemUnlogged(...args),
      ),
    args[2],
  );
}

export async function overwriteStockForDate(
  ...args: Parameters<typeof overwriteStockForDateUnlogged>
) {
  return withStockChange(
    args[0],
    () =>
      loggedAction(
        {
          feature: 'stock',
          event: 'mutations.overwriteStockForDate',
          target: ([, data]) => data.chestId,
        },
        args,
        () => overwriteStockForDateUnlogged(...args),
      ),
  );
}
