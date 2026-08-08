import type { StockMovementKind } from '@/generated/prisma/client';

export type ManualStockMovementInput = {
  itemId: string;
  newQty: number;
  stockToday: number | null;
  stockYesterday: number | null;
};

export type ManualStockMovementRecord = {
  itemId: string;
  quantity: number;
  kind: StockMovementKind;
  chestId?: string | null;
  destinationChestId?: string | null;
};

export function computeManualStockDelta({
  newQty,
  stockToday,
  stockYesterday,
}: {
  newQty: number;
  stockToday: number | null;
  stockYesterday: number | null;
}): { delta: number; kind: StockMovementKind } | null {
  if (stockToday === null) {
    const delta = newQty - (stockYesterday ?? 0);
    if (delta === 0) return null;
    return { delta, kind: 'MANUAL_FIRST_COUNT' };
  }

  const delta = newQty - stockToday;
  if (delta === 0) return null;
  return { delta, kind: 'MANUAL_ADJUST' };
}

export function buildManualMovements(
  items: ManualStockMovementInput[],
  skipHistory: boolean,
  chestId?: string | null,
): ManualStockMovementRecord[] {
  if (skipHistory) return [];

  const movements: ManualStockMovementRecord[] = [];

  for (const item of items) {
    const result = computeManualStockDelta({
      newQty: item.newQty,
      stockToday: item.stockToday,
      stockYesterday: item.stockYesterday,
    });
    if (!result) continue;
    movements.push({
      itemId: item.itemId,
      quantity: result.delta,
      kind: result.kind,
      chestId,
    });
  }

  return movements;
}

export type StockStatsItemRow = {
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  consumed: number;
  added: number;
  net: number;
};

export function totalsFromItems(items: StockStatsItemRow[]) {
  return items.reduce(
    (acc, row) => ({
      consumed: acc.consumed + row.consumed,
      added: acc.added + row.added,
      net: acc.net + row.net,
    }),
    { consumed: 0, added: 0, net: 0 },
  );
}
