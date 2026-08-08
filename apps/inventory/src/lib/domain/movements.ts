import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';
import { getDayAfter, getStartOfDay } from '@/lib/date';
import type { Prisma, StockMovementKind } from '@/generated/prisma/client';

function buildMovementWhere(
  scopeType: string,
  scopeId: string,
  filters: {
    itemSearch?: string;
    itemId?: string;
    chestFilter?: 'all' | 'global' | string;
    kind?: StockMovementKind;
    from?: Date;
    to?: Date;
  },
): Prisma.StockItemMovementWhereInput {
  const where: Prisma.StockItemMovementWhereInput = {
    item: {
      ...scopeWhere(scopeType, scopeId),
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

  if (filters.kind) where.kind = filters.kind;

  if (filters.chestFilter === 'global') {
    where.chestId = null;
  } else if (filters.chestFilter && filters.chestFilter !== 'all') {
    where.chestId = filters.chestFilter;
  }

  return where;
}

export async function listStockMovements(input: {
  scopeType: string;
  scopeId: string;
  page?: number;
  pageSize?: number;
  itemSearch?: string;
  itemId?: string;
  chestFilter?: 'all' | 'global' | string;
  kind?: StockMovementKind;
  from?: Date;
  to?: Date;
}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 25;
  const where = buildMovementWhere(input.scopeType, input.scopeId, input);
  const skip = (page - 1) * pageSize;

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
      take: pageSize,
    }),
    prisma.stockItemMovement.count({ where }),
  ]);

  return ok({
    items: rows.map((row) => ({
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
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    })),
    totalCount,
    page,
    pageSize,
  });
}

export async function updateStockMovement(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  quantity?: number;
  kind?: StockMovementKind;
  note?: string | null;
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.stockItemMovement.findFirst({
    where: {
      id: input.id,
      item: scopeWhere(input.scopeType, input.scopeId),
    },
  });
  if (!existing) return err('Mouvement introuvable', 404);

  const updated = await prisma.stockItemMovement.update({
    where: { id: input.id },
    data: {
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });
  return ok({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function deleteStockMovements(input: {
  scopeType: string;
  scopeId: string;
  ids: string[];
}): Promise<DomainResult<{ deleted: number }>> {
  const result = await prisma.stockItemMovement.deleteMany({
    where: {
      id: { in: input.ids },
      item: scopeWhere(input.scopeType, input.scopeId),
    },
  });
  return ok({ deleted: result.count });
}

function resolveReconciliationChestId(
  chestFilter: 'all' | 'global' | string,
): string | null | undefined {
  if (chestFilter === 'all') return undefined;
  if (chestFilter === 'global') return null;
  return chestFilter;
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

export async function getStockMovementReconciliation(input: {
  scopeType: string;
  scopeId: string;
  itemId: string;
  chestFilter?: 'all' | 'global' | string;
  from: Date;
  to: Date;
}): Promise<
  DomainResult<{
    itemId: string;
    itemName: string;
    chestFilter: 'all' | 'global' | string;
    chestName: string | null;
    from: string;
    to: string;
    stockAtPeriodStart: number | null;
    stockAtPeriodEnd: number | null;
    stockDelta: number;
    movementsSum: number;
    gap: number;
    hasGap: boolean;
    movementsWithoutChest: number;
    stockReconciliationAvailable: boolean;
  }>
> {
  const chestFilter = input.chestFilter ?? 'all';
  const fromStart = getStartOfDay(input.from);
  const toStart = getStartOfDay(input.to);
  if (fromStart > toStart) {
    return err('La date de début doit être antérieure ou égale à la date de fin', 400);
  }

  const toEndExclusive = getDayAfter(toStart);
  const periodBeforeStart = getStartOfDay(new Date(fromStart.getTime() - 24 * 60 * 60 * 1000));
  const resolvedChestId = resolveReconciliationChestId(chestFilter);
  const stockReconciliationAvailable = chestFilter !== 'global';

  const item = await prisma.item.findFirst({
    where: { id: input.itemId, ...scopeWhere(input.scopeType, input.scopeId) },
    select: { id: true, name: true },
  });
  if (!item) return err('Item introuvable', 404);

  let chestName: string | null = null;
  if (chestFilter === 'global') {
    chestName = 'Sans coffre';
  } else if (chestFilter !== 'all') {
    const chest = await prisma.chest.findFirst({
      where: { id: chestFilter, ...scopeWhere(input.scopeType, input.scopeId) },
      select: { name: true },
    });
    if (!chest) return err('Coffre introuvable', 404);
    chestName = chest.name;
  }

  const stockHistoryWhere = {
    itemId: input.itemId,
    ...(resolvedChestId ? { chestId: resolvedChestId } : {}),
  };

  const movementWhere: Prisma.StockItemMovementWhereInput = {
    itemId: input.itemId,
    createdAt: { gte: fromStart, lt: toEndExclusive },
  };
  if (chestFilter === 'global') {
    movementWhere.chestId = null;
  } else if (resolvedChestId) {
    movementWhere.chestId = resolvedChestId;
  }

  const [periodEndRows, periodStartRows, movementAgg, movementsWithoutChest] =
    await Promise.all([
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
      chestFilter === 'all'
        ? prisma.stockItemMovement.count({
            where: {
              itemId: input.itemId,
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

  return ok({
    itemId: item.id,
    itemName: item.name,
    chestFilter,
    chestName,
    from: fromStart.toISOString(),
    to: toStart.toISOString(),
    stockAtPeriodStart,
    stockAtPeriodEnd,
    stockDelta,
    movementsSum,
    gap,
    hasGap: stockReconciliationAvailable && gap !== 0,
    movementsWithoutChest,
    stockReconciliationAvailable,
  });
}

