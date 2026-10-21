'use server';

import { serviceActionError } from '@/lib/serviceAction';
import {
  getLastStockDaysByChest as getLastStockDaysByChestApi,
  queryItemsWithDetailedStock,
  queryItemsWithStock,
  queryItemsWithStockForDate,
} from '@lawless-intranet/inventory-client/server';
import {
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

export async function getLastStockDaysByChest(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const data = await getLastStockDaysByChestApi(
      { ...inventoryScope(businessId), effectiveRole },
      await inventoryCookie(),
    );

    const converted: Record<string, Date | null> = {};
    for (const [chestId, value] of Object.entries(data)) {
      converted[chestId] = value ? new Date(value) : null;
    }

    return { status: 200, data: converted };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des dates de dernier stock');
  }
}

export async function getItemsWithStock(
  businessSlug: string,
  chestId?: string | null,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const data = await queryItemsWithStock(
      {
        ...inventoryScope(businessId),
        chestId,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return { status: 200, data };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des objets avec stock');
  }
}

export async function getItemsWithStockForDate(
  businessSlug: string,
  date: Date,
  chestId?: string | null,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const data = await queryItemsWithStockForDate(
      {
        ...inventoryScope(businessId),
        date: date.toISOString(),
        chestId,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return { status: 200, data };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des objets avec stock');
  }
}

export async function getItemsWithDetailedStock(
  businessSlug: string,
  itemIds?: string[],
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'search',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const data = await queryItemsWithDetailedStock(
      {
        ...inventoryScope(businessId),
        itemIds,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return { status: 200, data };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des items avec stocks détaillés');
  }
}
