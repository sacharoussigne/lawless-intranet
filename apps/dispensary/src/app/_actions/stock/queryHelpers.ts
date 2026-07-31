import prisma from '@/lib/prisma';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { getStartOfDay } from '@/lib/date';
import {
  aggregateTodayAndPrevious,
  aggregateTodayYesterday,
  type StockHistoryRow,
} from '@/lib/stock/aggregateStock';

type StockHistoryClient = Pick<typeof prisma, 'stockHistory'>;

export const ITEM_STOCK_SELECT = {
  id: true,
  name: true,
  description: true,
  minimalQuantity: true,
  isCraftable: true,
  canBeSold: true,
  price: true,
  weight: true,
  categoryId: true,
  companyGroupId: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      order: true,
    },
  },
  companyGroup: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  minimalQuantity: number;
  isCraftable: boolean;
  canBeSold: boolean;
  price: unknown;
  weight: number | null;
  categoryId: string;
  companyGroupId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    color: string;
    order: number;
  } | null;
  companyGroup: {
    id: string;
    name: string;
  } | null;
};

export function mapItemWithStockSnapshot(
  item: ItemRow,
  snapshot: { stockToday: number | null; stockYesterday: number | null; stockPreviousAt?: Date | null } | undefined,
) {
  return {
    ...item,
    stockToday: snapshot?.stockToday ?? null,
    stockYesterday: snapshot?.stockYesterday ?? null,
    stockPreviousAt: snapshot?.stockPreviousAt ?? null,
    price: item.price ? Number(item.price) : null,
  };
}

export async function fetchEnabledItems(dispensaryId: string, orderBy: 'createdAt' | 'name' = 'createdAt') {
  return prisma.item.findMany({
    where: {
      isEnabled: true,
      ...tenantWhere(dispensaryId),
    },
    orderBy: orderBy === 'name' ? { name: 'asc' } : { createdAt: 'desc' },
    select: ITEM_STOCK_SELECT,
  });
}

export async function fetchStockHistoryRows(
  dispensaryId: string,
  itemIds: string[],
  range: { gte: Date; lt: Date },
  chestId?: string | null,
  allowedChestIds?: string[] | null,
): Promise<StockHistoryRow[]> {
  if (itemIds.length === 0) return [];
  if (allowedChestIds && allowedChestIds.length === 0) return [];

  const rows = await prisma.stockHistory.findMany({
    where: {
      itemId: { in: itemIds },
      ...(chestId
        ? { chestId }
        : allowedChestIds
          ? { chestId: { in: allowedChestIds } }
          : {}),
      timestamp: range,
      chest: {
        isEnabled: true,
        ...tenantWhere(dispensaryId),
      },
    },
    select: {
      itemId: true,
      chestId: true,
      quantity: true,
      timestamp: true,
    },
    orderBy: { timestamp: 'desc' },
  });

  return rows;
}

export function buildStockSnapshots(
  stockRows: StockHistoryRow[],
  today: Date,
  yesterday: Date,
  chestId?: string | null,
) {
  return aggregateTodayYesterday(stockRows, today, yesterday, chestId);
}

export function buildStockSnapshotsWithPrevious(
  stockRowsToday: StockHistoryRow[],
  previousRows: StockHistoryRow[],
  today: Date,
  chestId?: string | null,
) {
  return aggregateTodayAndPrevious(stockRowsToday, previousRows, today, chestId);
}

export async function fetchLatestStockBeforeDate(
  client: StockHistoryClient,
  dispensaryId: string,
  itemIds: string[],
  beforeDate: Date,
  chestId?: string | null,
  allowedChestIds?: string[] | null,
): Promise<StockHistoryRow[]> {
  if (itemIds.length === 0) return [];
  if (allowedChestIds && allowedChestIds.length === 0) return [];

  const baseWhere = {
    itemId: { in: itemIds },
    timestamp: { lt: beforeDate },
    ...(chestId
      ? { chestId }
      : allowedChestIds
        ? { chestId: { in: allowedChestIds } }
        : {}),
    chest: {
      isEnabled: true,
      ...tenantWhere(dispensaryId),
    },
  };

  const groups = await client.stockHistory.groupBy({
    by: chestId ? ['itemId'] : ['itemId', 'chestId'],
    where: baseWhere,
    _max: { timestamp: true },
  });

  if (groups.length === 0) return [];

  const latestRows = await client.stockHistory.findMany({
    where: {
      OR: groups.map((group) => ({
        itemId: group.itemId,
        ...(!chestId && 'chestId' in group ? { chestId: group.chestId } : {}),
        timestamp: group._max.timestamp!,
        ...(chestId ? { chestId } : {}),
      })),
    },
    select: {
      itemId: true,
      chestId: true,
      quantity: true,
      timestamp: true,
    },
  });

  const latestByKey = new Map<string, StockHistoryRow>();
  for (const row of latestRows) {
    const key = chestId ? row.itemId : `${row.itemId}:${row.chestId}`;
    const existing = latestByKey.get(key);
    if (!existing || row.timestamp.getTime() > existing.timestamp.getTime()) {
      latestByKey.set(key, row);
    }
  }

  return Array.from(latestByKey.values());
}

export async function fetchLastStockDayByChest(
  dispensaryId: string,
  chestIds: string[],
  beforeDate: Date,
): Promise<Record<string, Date | null>> {
  const result: Record<string, Date | null> = Object.fromEntries(
    chestIds.map((chestId) => [chestId, null]),
  );

  if (chestIds.length === 0) {
    return result;
  }

  const groups = await prisma.stockHistory.groupBy({
    by: ['chestId'],
    where: {
      chestId: { in: chestIds },
      timestamp: { lt: beforeDate },
      chest: {
        isEnabled: true,
        ...tenantWhere(dispensaryId),
      },
    },
    _max: { timestamp: true },
  });

  for (const group of groups) {
    if (group._max.timestamp) {
      result[group.chestId] = getStartOfDay(group._max.timestamp);
    }
  }

  return result;
}
