import { formatDate, getStartOfDay } from '@/lib/date';

export type StockHistoryRow = {
  itemId: string;
  chestId: string;
  quantity: number;
  timestamp: Date;
};

export type StockSnapshot = {
  stockToday: number | null;
  stockYesterday: number | null;
  stockPreviousAt: Date | null;
};

function resolvePreviousAt(rows: StockHistoryRow[]): Date | null {
  if (rows.length === 0) return null;

  const dayKeys = new Set(rows.map((row) => formatDate(row.timestamp)));
  if (dayKeys.size !== 1) return null;

  return getStartOfDay(rows[0].timestamp);
}

function buildPreviousMeta(
  rows: StockHistoryRow[],
  chestId?: string | null,
): { quantity: number | null; at: Date | null } {
  if (rows.length === 0) {
    return { quantity: null, at: null };
  }

  const quantity = chestId
    ? rows[0].quantity
    : rows.reduce((sum, row) => sum + row.quantity, 0);

  return {
    quantity,
    at: resolvePreviousAt(rows),
  };
}

function latestByDay(
  rows: StockHistoryRow[],
  day: Date,
): Map<string, StockHistoryRow> {
  const dayStr = formatDate(day);
  const byKey = new Map<string, StockHistoryRow>();

  for (const row of rows) {
    if (formatDate(new Date(row.timestamp)) !== dayStr) continue;

    const key = row.chestId;
    const existing = byKey.get(key);
    if (!existing || new Date(row.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      byKey.set(key, row);
    }
  }

  return byKey;
}

export function aggregateTodayYesterday(
  stockRows: StockHistoryRow[],
  today: Date,
  yesterday: Date,
  chestId?: string | null,
): Map<string, StockSnapshot> {
  const byItem = new Map<string, StockHistoryRow[]>();

  for (const row of stockRows) {
    const list = byItem.get(row.itemId) ?? [];
    list.push(row);
    byItem.set(row.itemId, list);
  }

  const result = new Map<string, StockSnapshot>();

  for (const [itemId, rows] of byItem) {
    if (chestId) {
      const chestRows = rows.filter((r) => r.chestId === chestId);
      const todayRow = latestByDay(chestRows, today).get(chestId);
      const yesterdayRow = latestByDay(chestRows, yesterday).get(chestId);
      result.set(itemId, {
        stockToday: todayRow?.quantity ?? null,
        stockYesterday: yesterdayRow?.quantity ?? null,
        stockPreviousAt: yesterdayRow ? getStartOfDay(yesterdayRow.timestamp) : null,
      });
      continue;
    }

    const todayByChest = latestByDay(rows, today);
    const yesterdayByChest = latestByDay(rows, yesterday);
    const yesterdayRows = Array.from(yesterdayByChest.values());

    result.set(itemId, {
      stockToday: todayByChest.size > 0
        ? Array.from(todayByChest.values()).reduce((sum, r) => sum + r.quantity, 0)
        : null,
      stockYesterday: yesterdayRows.length > 0
        ? yesterdayRows.reduce((sum, r) => sum + r.quantity, 0)
        : null,
      stockPreviousAt: resolvePreviousAt(yesterdayRows),
    });
  }

  return result;
}

export function aggregateTodayAndPrevious(
  stockRowsToday: StockHistoryRow[],
  previousRows: StockHistoryRow[],
  today: Date,
  chestId?: string | null,
): Map<string, StockSnapshot> {
  const byItem = new Map<string, StockHistoryRow[]>();

  for (const row of stockRowsToday) {
    const list = byItem.get(row.itemId) ?? [];
    list.push(row);
    byItem.set(row.itemId, list);
  }

  const previousRowsByItem = new Map<string, StockHistoryRow[]>();
  for (const row of previousRows) {
    if (chestId && row.chestId !== chestId) continue;
    const list = previousRowsByItem.get(row.itemId) ?? [];
    list.push(row);
    previousRowsByItem.set(row.itemId, list);
  }

  const allItemIds = new Set([
    ...byItem.keys(),
    ...previousRows.map((row) => row.itemId),
  ]);

  const result = new Map<string, StockSnapshot>();

  for (const itemId of allItemIds) {
    const rows = byItem.get(itemId) ?? [];
    const itemPreviousRows = previousRowsByItem.get(itemId) ?? [];
    const previousMeta = buildPreviousMeta(itemPreviousRows, chestId);

    if (chestId) {
      const chestRows = rows.filter((r) => r.chestId === chestId);
      const todayRow = latestByDay(chestRows, today).get(chestId);
      result.set(itemId, {
        stockToday: todayRow?.quantity ?? null,
        stockYesterday: previousMeta.quantity,
        stockPreviousAt: previousMeta.at,
      });
      continue;
    }

    const todayByChest = latestByDay(rows, today);
    result.set(itemId, {
      stockToday: todayByChest.size > 0
        ? Array.from(todayByChest.values()).reduce((sum, r) => sum + r.quantity, 0)
        : null,
      stockYesterday: previousMeta.quantity,
      stockPreviousAt: previousMeta.at,
    });
  }

  return result;
}
