import type { Prisma } from '@/generated/prisma/client';
import { getTodayStart, getTomorrowStart } from '@/lib/date';
import { scopeWhere } from '@/lib/scope';

export type StockPair = {
  itemId: string;
  chestId: string;
};

export type TodayStockRow = {
  id: string;
  itemId: string;
  chestId: string;
  quantity: number;
};

type StockClient = Pick<Prisma.TransactionClient, 'stockHistory' | 'chest'>;

function pairKey(itemId: string, chestId: string): string {
  return `${itemId}:${chestId}`;
}

function dedupePairs(pairs: StockPair[]): StockPair[] {
  const seen = new Set<string>();
  const result: StockPair[] = [];
  for (const pair of pairs) {
    if (!pair.itemId || !pair.chestId) continue;
    const key = pairKey(pair.itemId, pair.chestId);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(pair);
  }
  return result;
}

async function fetchLatestPreviousForPairs(
  client: Pick<Prisma.TransactionClient, 'stockHistory'>,
  scopeType: string,
  scopeId: string,
  pairs: StockPair[],
  beforeDate: Date,
): Promise<Map<string, number>> {
  if (pairs.length === 0) return new Map();

  const itemIds = Array.from(new Set(pairs.map((p) => p.itemId)));
  const chestIds = Array.from(new Set(pairs.map((p) => p.chestId)));

  const groups = await client.stockHistory.groupBy({
    by: ['itemId', 'chestId'],
    where: {
      itemId: { in: itemIds },
      chestId: { in: chestIds },
      timestamp: { lt: beforeDate },
      chest: {
        isEnabled: true,
        ...scopeWhere(scopeType, scopeId),
      },
    },
    _max: { timestamp: true },
  });

  const wanted = new Set(pairs.map((p) => pairKey(p.itemId, p.chestId)));
  const relevantGroups = groups.filter(
    (g) => wanted.has(pairKey(g.itemId, g.chestId)) && g._max.timestamp,
  );

  if (relevantGroups.length === 0) return new Map();

  const rows = await client.stockHistory.findMany({
    where: {
      OR: relevantGroups.map((g) => ({
        itemId: g.itemId,
        chestId: g.chestId,
        timestamp: g._max.timestamp!,
      })),
    },
    select: {
      itemId: true,
      chestId: true,
      quantity: true,
      timestamp: true,
    },
  });

  const latest = new Map<string, { quantity: number; timestamp: Date }>();
  for (const row of rows) {
    const key = pairKey(row.itemId, row.chestId);
    const existing = latest.get(key);
    if (!existing || row.timestamp.getTime() > existing.timestamp.getTime()) {
      latest.set(key, { quantity: row.quantity, timestamp: row.timestamp });
    }
  }

  return new Map(Array.from(latest.entries()).map(([key, value]) => [key, value.quantity]));
}

export async function ensureTodayStockForAllActiveChests(
  client: StockClient,
  scopeType: string,
  scopeId: string,
  options?: { today?: Date; tomorrow?: Date },
): Promise<void> {
  const today = options?.today ?? getTodayStart();
  const tomorrow = options?.tomorrow ?? getTomorrowStart();

  const chests = await client.chest.findMany({
    where: {
      isEnabled: true,
      ...scopeWhere(scopeType, scopeId),
    },
    select: { id: true },
  });
  if (chests.length === 0) return;

  const chestIds = chests.map((chest) => chest.id);

  const [todayRows, previousGroups] = await Promise.all([
    client.stockHistory.findMany({
      where: {
        chestId: { in: chestIds },
        timestamp: { gte: today, lt: tomorrow },
      },
      select: { itemId: true, chestId: true },
      distinct: ['itemId', 'chestId'],
    }),
    client.stockHistory.groupBy({
      by: ['itemId', 'chestId'],
      where: {
        chestId: { in: chestIds },
        timestamp: { lt: today },
        chest: {
          isEnabled: true,
          ...scopeWhere(scopeType, scopeId),
        },
      },
      _max: { timestamp: true },
    }),
  ]);

  const todayKeys = new Set(todayRows.map((row) => pairKey(row.itemId, row.chestId)));
  const missingPairs: StockPair[] = previousGroups
    .filter((group) => group._max.timestamp && !todayKeys.has(pairKey(group.itemId, group.chestId)))
    .map((group) => ({ itemId: group.itemId, chestId: group.chestId }));

  if (missingPairs.length === 0) return;

  await ensureTodayStockForPairs(client, scopeType, scopeId, missingPairs, { today, tomorrow });
}

export async function ensureTodayStockForPairs(
  client: Pick<Prisma.TransactionClient, 'stockHistory'>,
  scopeType: string,
  scopeId: string,
  pairs: StockPair[],
  options?: { today?: Date; tomorrow?: Date },
): Promise<Map<string, TodayStockRow>> {
  const uniquePairs = dedupePairs(pairs);
  const result = new Map<string, TodayStockRow>();
  if (uniquePairs.length === 0) return result;

  const today = options?.today ?? getTodayStart();
  const tomorrow = options?.tomorrow ?? getTomorrowStart();

  const itemIds = Array.from(new Set(uniquePairs.map((p) => p.itemId)));
  const chestIds = Array.from(new Set(uniquePairs.map((p) => p.chestId)));

  const todayRows = await client.stockHistory.findMany({
    where: {
      itemId: { in: itemIds },
      chestId: { in: chestIds },
      timestamp: { gte: today, lt: tomorrow },
      chest: {
        isEnabled: true,
        ...scopeWhere(scopeType, scopeId),
      },
    },
    orderBy: { timestamp: 'desc' },
    select: {
      id: true,
      itemId: true,
      chestId: true,
      quantity: true,
    },
  });

  for (const row of todayRows) {
    const key = pairKey(row.itemId, row.chestId);
    if (!result.has(key)) {
      result.set(key, row);
    }
  }

  const missingPairs = uniquePairs.filter((p) => !result.has(pairKey(p.itemId, p.chestId)));
  if (missingPairs.length === 0) return result;

  const previousQtyByKey = await fetchLatestPreviousForPairs(
    client,
    scopeType,
    scopeId,
    missingPairs,
    today,
  );

  const toCreate = missingPairs
    .map((pair) => {
      const key = pairKey(pair.itemId, pair.chestId);
      const previousQty = previousQtyByKey.get(key);
      if (previousQty === undefined) return null;
      return {
        itemId: pair.itemId,
        chestId: pair.chestId,
        quantity: previousQty,
        timestamp: today,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (toCreate.length > 0) {
    await client.stockHistory.createMany({ data: toCreate });

    const createdRows = await client.stockHistory.findMany({
      where: {
        OR: toCreate.map((row) => ({
          itemId: row.itemId,
          chestId: row.chestId,
          timestamp: { gte: today, lt: tomorrow },
        })),
      },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        itemId: true,
        chestId: true,
        quantity: true,
      },
    });

    for (const row of createdRows) {
      const key = pairKey(row.itemId, row.chestId);
      if (!result.has(key)) {
        result.set(key, row);
      }
    }
  }

  return result;
}
