'use server';

import { serviceActionError } from '@/lib/serviceAction';
import { getStockConsumptionStats as getStockConsumptionStatsApi } from '@lawless-intranet/inventory-client/server';
import {
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
  businessSlug: string,
  data: { from: Date; to: Date },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'stock',
      permission: {
        resource: 'stock_statistics',
        action: 'view',
        message:
          "Permission refusée : vous n'avez pas accès aux statistiques de stock",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const result = await getStockConsumptionStatsApi(
      {
        ...inventoryScope(businessId),
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
    return serviceActionError(error, 'Erreur lors de la récupération des statistiques de stock');
  }
}
