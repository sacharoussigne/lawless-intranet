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
