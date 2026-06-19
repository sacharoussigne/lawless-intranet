'use server';

import { Prisma, StockMovementKind } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { fetchUserProfiles } from '@/lib/authUsers';
import { getDayAfter, getStartOfDay } from '@/lib/date';
import type {
  StockMovementReconciliationResult,
  StockMovementsPageResult,
} from '@/types/stock';

const getStockMovementsPageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(25),
  itemSearch: z.string().max(255).optional(),
  itemId: z.string().uuid().optional(),
  chestFilter: z.enum(['all', 'global']).or(z.string().uuid()).optional(),
  kind: z.nativeEnum(StockMovementKind).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const updateStockMovementSchema = z.object({
  id: z.string().uuid('ID invalide'),
  quantity: z.number().int().optional(),
  kind: z.nativeEnum(StockMovementKind).optional(),
  note: z.string().max(500).nullable().optional(),
});

const deleteStockMovementSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const getStockMovementReconciliationSchema = z.object({
  itemId: z.string().uuid('ID item invalide'),
  chestFilter: z.enum(['all', 'global']).or(z.string().uuid()).default('all'),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

function resolveReconciliationChestId(
  chestFilter: z.infer<typeof getStockMovementReconciliationSchema>['chestFilter'],
): string | null | undefined {
  if (chestFilter === 'all') return undefined;
  if (chestFilter === 'global') return null;
  return chestFilter;
}

function buildMovementWhere(
  dispensaryId: string,
  filters: z.infer<typeof getStockMovementsPageSchema>,
): Prisma.StockItemMovementWhereInput {
  const where: Prisma.StockItemMovementWhereInput = {
    item: {
      dispensaryId,
      ...(filters.itemId ? { id: filters.itemId } : {}),
      ...(filters.itemSearch
        ? { name: { contains: filters.itemSearch, mode: 'insensitive' } }
        : {}),
    },
  };

  if (filters.from || filters.to) {
    const fromStart = filters.from ? getStartOfDay(filters.from) : undefined;
    const toEndExclusive = filters.to ? getDayAfter(getStartOfDay(filters.to)) : undefined;
    where.createdAt = {
      ...(fromStart ? { gte: fromStart } : {}),
      ...(toEndExclusive ? { lt: toEndExclusive } : {}),
    };
  }

  if (filters.kind) {
    where.kind = filters.kind;
  }

  if (filters.chestFilter === 'global') {
    where.chestId = null;
  } else if (filters.chestFilter && filters.chestFilter !== 'all') {
    where.chestId = filters.chestFilter;
  }

  return where;
}

async function assertMovementBelongsToTenant(movementId: string, dispensaryId: string) {
  return prisma.stockItemMovement.findFirst({
    where: {
      id: movementId,
      item: { dispensaryId },
    },
  });
}

export async function getStockMovementsPage(
  dispensarySlug: string,
  params: {
    page?: number;
    pageSize?: number;
    itemSearch?: string;
    itemId?: string;
    chestFilter?: 'all' | 'global' | string;
    kind?: StockMovementKind;
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
        message: 'Permission refusée : vous n\'avez pas accès à l\'historique des mouvements',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const filters = getStockMovementsPageSchema.parse(params);
    const where = buildMovementWhere(dispensaryId, filters);
    const skip = (filters.page - 1) * filters.pageSize;

    const [rows, totalCount] = await Promise.all([
      prisma.stockItemMovement.findMany({
        where,
        include: {
          item: {
            select: {
              name: true,
              category: { select: { name: true } },
            },
          },
          chest: { select: { name: true } },
          destinationChest: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.pageSize,
      }),
      prisma.stockItemMovement.count({ where }),
    ]);

    const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
    const profiles = userIds.length > 0 ? await fetchUserProfiles(userIds) : new Map();

    const items = rows.map((row) => ({
      id: row.id,
      itemId: row.itemId,
      itemName: row.item.name,
      categoryName: row.item.category.name,
      chestId: row.chestId,
      chestName: row.chest?.name ?? null,
      destinationChestId: row.destinationChestId,
      destinationChestName: row.destinationChest?.name ?? null,
      quantity: row.quantity,
      kind: row.kind,
      userId: row.userId,
      userName: row.userId ? (profiles.get(row.userId)?.name ?? null) : null,
      note: row.note,
      createdAt: row.createdAt,
    }));

    return {
      status: 200,
      data: {
        items,
        totalCount,
        page: filters.page,
        pageSize: filters.pageSize,
      } satisfies StockMovementsPageResult,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des mouvements de stock');
  }
}

export async function updateStockMovement(
  dispensarySlug: string,
  data: {
    id: string;
    quantity?: number;
    kind?: StockMovementKind;
    note?: string | null;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message: 'Permission refusée : vous n\'avez pas la permission de modifier l\'historique',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = updateStockMovementSchema.parse(data);
    const existing = await assertMovementBelongsToTenant(validated.id, dispensaryId);
    if (!existing) {
      return { status: 404, error: 'Mouvement introuvable' };
    }

    const updated = await prisma.stockItemMovement.update({
      where: { id: validated.id },
      data: {
        ...(validated.quantity !== undefined ? { quantity: validated.quantity } : {}),
        ...(validated.kind !== undefined ? { kind: validated.kind } : {}),
        ...(validated.note !== undefined ? { note: validated.note } : {}),
      },
      include: {
        item: {
          select: {
            name: true,
            category: { select: { name: true } },
          },
        },
        chest: { select: { name: true } },
        destinationChest: { select: { name: true } },
      },
    });

    const profiles = updated.userId
      ? await fetchUserProfiles([updated.userId])
      : new Map();

    return {
      status: 200,
      data: {
        id: updated.id,
        itemId: updated.itemId,
        itemName: updated.item.name,
        categoryName: updated.item.category.name,
        chestId: updated.chestId,
        chestName: updated.chest?.name ?? null,
        destinationChestId: updated.destinationChestId,
        destinationChestName: updated.destinationChest?.name ?? null,
        quantity: updated.quantity,
        kind: updated.kind,
        userId: updated.userId,
        userName: updated.userId ? (profiles.get(updated.userId)?.name ?? null) : null,
        note: updated.note,
        createdAt: updated.createdAt,
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la modification du mouvement');
  }
}

export async function deleteStockMovement(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message: 'Permission refusée : vous n\'avez pas la permission de supprimer l\'historique',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = deleteStockMovementSchema.parse(data);
    const existing = await assertMovementBelongsToTenant(validated.id, dispensaryId);
    if (!existing) {
      return { status: 404, error: 'Mouvement introuvable' };
    }

    await prisma.stockItemMovement.delete({ where: { id: validated.id } });

    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du mouvement');
  }
}

function aggregateStockQuantity(
  rows: { chestId: string; quantity: number }[],
  chestId?: string | null,
): number | null {
  if (rows.length === 0) return null;
  if (chestId) return rows[0]?.quantity ?? null;

  const latestByChest = new Map<string, number>();
  for (const row of rows) {
    if (!latestByChest.has(row.chestId)) {
      latestByChest.set(row.chestId, row.quantity);
    }
  }
  return [...latestByChest.values()].reduce((sum, qty) => sum + qty, 0);
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
        message: 'Permission refusée : vous n\'avez pas accès à la réconciliation',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = getStockMovementReconciliationSchema.parse(data);
    const fromStart = getStartOfDay(validated.from);
    const toStart = getStartOfDay(validated.to);
    if (fromStart > toStart) {
      return { status: 400, error: 'La date de début doit être antérieure ou égale à la date de fin' };
    }

    const toEndExclusive = getDayAfter(toStart);
    const periodBeforeStart = getStartOfDay(
      new Date(fromStart.getTime() - 24 * 60 * 60 * 1000),
    );
    const resolvedChestId = resolveReconciliationChestId(validated.chestFilter);
    const stockReconciliationAvailable = validated.chestFilter !== 'global';

    const item = await prisma.item.findFirst({
      where: { id: validated.itemId, dispensaryId },
      select: { id: true, name: true },
    });
    if (!item) {
      return { status: 404, error: 'Item introuvable' };
    }

    let chestName: string | null = null;
    if (validated.chestFilter === 'global') {
      chestName = 'Sans coffre';
    } else if (validated.chestFilter !== 'all') {
      const chest = await prisma.chest.findFirst({
        where: { id: validated.chestFilter, dispensaryId },
        select: { name: true },
      });
      if (!chest) {
        return { status: 404, error: 'Coffre introuvable' };
      }
      chestName = chest.name;
    }

    const stockHistoryWhere = {
      itemId: validated.itemId,
      ...(resolvedChestId ? { chestId: resolvedChestId } : {}),
    };

    const movementWhere: Prisma.StockItemMovementWhereInput = {
      itemId: validated.itemId,
      createdAt: { gte: fromStart, lt: toEndExclusive },
    };
    if (validated.chestFilter === 'global') {
      movementWhere.chestId = null;
    } else if (resolvedChestId) {
      movementWhere.chestId = resolvedChestId;
    }

    const [periodEndRows, periodStartRows, movementAgg, movementsWithoutChest] = await Promise.all([
      stockReconciliationAvailable
        ? prisma.stockHistory.findMany({
            where: {
              ...stockHistoryWhere,
              timestamp: { gte: toStart, lt: toEndExclusive },
            },
            orderBy: { timestamp: 'desc' },
            select: { chestId: true, quantity: true },
          })
        : Promise.resolve([]),
      stockReconciliationAvailable
        ? prisma.stockHistory.findMany({
            where: {
              ...stockHistoryWhere,
              timestamp: { gte: periodBeforeStart, lt: fromStart },
            },
            orderBy: { timestamp: 'desc' },
            select: { chestId: true, quantity: true },
          })
        : Promise.resolve([]),
      prisma.stockItemMovement.aggregate({
        where: movementWhere,
        _sum: { quantity: true },
      }),
      validated.chestFilter === 'all'
        ? prisma.stockItemMovement.count({
            where: {
              itemId: validated.itemId,
              createdAt: { gte: fromStart, lt: toEndExclusive },
              chestId: null,
            },
          })
        : Promise.resolve(0),
    ]);

    const stockAtPeriodEnd = stockReconciliationAvailable
      ? aggregateStockQuantity(periodEndRows, resolvedChestId)
      : null;
    const stockAtPeriodStart = stockReconciliationAvailable
      ? aggregateStockQuantity(periodStartRows, resolvedChestId)
      : null;

    const stockDelta = stockReconciliationAvailable
      ? (stockAtPeriodEnd ?? 0) - (stockAtPeriodStart ?? 0)
      : 0;
    const movementsSum = movementAgg._sum.quantity ?? 0;
    const gap = stockReconciliationAvailable ? stockDelta - movementsSum : 0;

    return {
      status: 200,
      data: {
        itemId: item.id,
        itemName: item.name,
        chestFilter: validated.chestFilter,
        chestName,
        from: fromStart,
        to: toStart,
        stockAtPeriodStart,
        stockAtPeriodEnd,
        stockDelta,
        movementsSum,
        gap,
        hasGap: stockReconciliationAvailable && gap !== 0,
        movementsWithoutChest,
        stockReconciliationAvailable,
      } satisfies StockMovementReconciliationResult,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la réconciliation des mouvements');
  }
}
