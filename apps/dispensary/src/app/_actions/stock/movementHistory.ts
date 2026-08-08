'use server';

import { z } from 'zod';
import type { StockMovementKind as StockMovementKindType } from '@lawless-intranet/inventory-client';
import {
  deleteStockMovements as deleteStockMovementsApi,
  listStockMovements,
  updateStockMovement as updateStockMovementApi,
} from '@lawless-intranet/inventory-client/server';
import { actionErrorParser } from '@/lib/action';
import { fetchUserProfiles } from '@/lib/authUsers';
import {
  inventoryActionError,
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { StockMovementKind } from '@/lib/stock/movements';
import type {
  StockMovementReconciliationResult,
  StockMovementsPageResult,
} from '@/types/stock';

const stockMovementKindSchema = z.enum(
  Object.values(StockMovementKind) as [StockMovementKindType, ...StockMovementKindType[]],
);

const getStockMovementsPageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(25),
  itemSearch: z.string().max(255).optional(),
  itemId: z.string().uuid().optional(),
  chestFilter: z.enum(['all', 'global']).or(z.string().uuid()).optional(),
  kind: stockMovementKindSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const updateStockMovementSchema = z.object({
  id: z.string().uuid('ID invalide'),
  quantity: z.number().int().optional(),
  kind: stockMovementKindSchema.optional(),
  note: z.string().max(500).nullable().optional(),
});

const deleteStockMovementsSchema = z.object({
  ids: z.array(z.string().uuid('ID invalide')).min(1).max(200),
});

const getStockMovementReconciliationSchema = z.object({
  itemId: z.string().uuid('ID item invalide'),
  chestFilter: z.enum(['all', 'global']).or(z.string().uuid()).default('all'),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export async function getStockMovementsPage(
  dispensarySlug: string,
  params: {
    page?: number;
    pageSize?: number;
    itemSearch?: string;
    itemId?: string;
    chestFilter?: 'all' | 'global' | string;
    kind?: StockMovementKindType;
    from?: Date;
    to?: Date;
  } = {},
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock_statistics',
        action: 'view',
        message:
          "Permission refusée : vous n'avez pas accès à l'historique des mouvements",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const filters = getStockMovementsPageSchema.parse(params);
    const page = await listStockMovements(
      {
        ...inventoryScope(dispensaryId),
        page: filters.page,
        pageSize: filters.pageSize,
        itemSearch: filters.itemSearch,
        itemId: filters.itemId,
        chestFilter: filters.chestFilter,
        kind: filters.kind,
        from: filters.from?.toISOString(),
        to: filters.to?.toISOString(),
      },
      await inventoryCookie(),
    );

    const userIds = [
      ...new Set(
        page.items
          .map((row) => row.userId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const profiles = userIds.length > 0 ? await fetchUserProfiles(userIds) : new Map();

    const items = page.items.map((row) => ({
      id: row.id,
      itemId: row.itemId,
      itemName: row.itemName,
      categoryName: row.categoryName,
      chestId: row.chestId,
      chestName: row.chestName,
      destinationChestId: row.destinationChestId,
      destinationChestName: row.destinationChestName,
      quantity: row.quantity,
      kind: row.kind,
      userId: row.userId,
      userName: row.userId ? (profiles.get(row.userId)?.name ?? null) : null,
      note: row.note,
      createdAt: new Date(row.createdAt),
    }));

    return {
      status: 200,
      data: {
        items,
        totalCount: page.totalCount,
        page: page.page,
        pageSize: page.pageSize,
      } satisfies StockMovementsPageResult,
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des mouvements de stock',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des mouvements de stock',
      );
    }
  }
}

export async function updateStockMovement(
  dispensarySlug: string,
  data: {
    id: string;
    quantity?: number;
    kind?: StockMovementKindType;
    note?: string | null;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de modifier l'historique",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = updateStockMovementSchema.parse(data);
    const updated = await updateStockMovementApi(
      {
        ...inventoryScope(dispensaryId),
        id: validated.id,
        quantity: validated.quantity,
        kind: validated.kind,
        note: validated.note,
      },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: updated,
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la modification du mouvement',
      );
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification du mouvement');
    }
  }
}

export async function deleteStockMovement(
  dispensarySlug: string,
  data: { id: string },
) {
  return deleteStockMovements(dispensarySlug, { ids: [data.id] });
}

export async function deleteStockMovements(
  dispensarySlug: string,
  data: { ids: string[] },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de supprimer l'historique",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = deleteStockMovementsSchema.parse(data);
    const uniqueIds = [...new Set(validated.ids)];

    const result = await deleteStockMovementsApi(
      {
        ...inventoryScope(dispensaryId),
        ids: uniqueIds,
      },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: { success: true, deletedCount: result.deleted },
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la suppression des mouvements',
      );
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression des mouvements');
    }
  }
}

export async function getStockMovementReconciliation(
  dispensarySlug: string,
  data: {
    itemId: string;
    chestFilter?: 'all' | 'global' | string;
    from: Date;
    to: Date;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock_statistics',
        action: 'view',
        message: "Permission refusée : vous n'avez pas accès à la réconciliation",
      },
    });
    if (!ctx.ok) return ctx.response;

    getStockMovementReconciliationSchema.parse(data);

    // TODO: Inventory service has no stock movement reconciliation endpoint yet.
    return {
      status: 501,
      error: 'Stock movement reconciliation is not available via inventory service yet',
    } as { status: 501; error: string; data?: StockMovementReconciliationResult };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la réconciliation des mouvements',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la réconciliation des mouvements',
      );
    }
  }
}
