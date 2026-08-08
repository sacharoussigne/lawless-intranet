'use server';

import {
  getLastStockDaysByChest as getLastStockDaysByChestApi,
  queryItemsWithDetailedStock,
  queryItemsWithStock,
  queryItemsWithStockForDate,
} from '@lawless-intranet/inventory-client/server';
import { actionErrorParser } from '@/lib/action';
import {
  inventoryActionError,
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

export async function getLastStockDaysByChest(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

    const data = await getLastStockDaysByChestApi(
      { ...inventoryScope(dispensaryId), effectiveRole },
      await inventoryCookie(),
    );

    const converted: Record<string, Date | null> = {};
    for (const [chestId, value] of Object.entries(data)) {
      converted[chestId] = value ? new Date(value) : null;
    }

    return { status: 200, data: converted };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des dates de dernier stock',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des dates de dernier stock',
      );
    }
  }
}

export async function getItemsWithStock(
  dispensarySlug: string,
  chestId?: string | null,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

    const data = await queryItemsWithStock(
      {
        ...inventoryScope(dispensaryId),
        chestId,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return { status: 200, data };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des objets avec stock',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des objets avec stock',
      );
    }
  }
}

export async function getItemsWithStockForDate(
  dispensarySlug: string,
  date: Date,
  chestId?: string | null,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

    const data = await queryItemsWithStockForDate(
      {
        ...inventoryScope(dispensaryId),
        date: date.toISOString(),
        chestId,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return { status: 200, data };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des objets avec stock',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des objets avec stock',
      );
    }
  }
}

export async function getItemsWithDetailedStock(
  dispensarySlug: string,
  itemIds?: string[],
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'search',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

    const data = await queryItemsWithDetailedStock(
      {
        ...inventoryScope(dispensaryId),
        itemIds,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return { status: 200, data };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des items avec stocks détaillés',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des items avec stocks détaillés',
      );
    }
  }
}
