'use server';

import { getStockConsumptionStats as getStockConsumptionStatsApi } from '@lawless-intranet/inventory-client/server';
import { actionErrorParser } from '@/lib/action';
import {
  inventoryActionError,
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import type { StockStatsItemRow } from '@/lib/stock/movements';

export type StockConsumptionStatsResult = {
  items: StockStatsItemRow[];
  totals: {
    consumed: number;
    added: number;
    net: number;
  };
};

export async function getStockConsumptionStats(
  dispensarySlug: string,
  data: { from: Date; to: Date },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock_statistics',
        action: 'view',
        message:
          "Permission refusée : vous n'avez pas accès aux statistiques de stock",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const result = await getStockConsumptionStatsApi(
      {
        ...inventoryScope(dispensaryId),
        from: data.from.toISOString(),
        to: data.to.toISOString(),
      },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: result satisfies StockConsumptionStatsResult,
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des statistiques de stock',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des statistiques de stock',
      );
    }
  }
}
