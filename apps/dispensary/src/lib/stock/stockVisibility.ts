export type ChestStockVisibility = {
  hiddenCategoryIds: string[];
  hiddenItemIds: string[];
};

export const EMPTY_CHEST_STOCK_VISIBILITY: ChestStockVisibility = {
  hiddenCategoryIds: [],
  hiddenItemIds: [],
};

export function isCategoryHidden(
  categoryId: string,
  visibility: ChestStockVisibility,
): boolean {
  return visibility.hiddenCategoryIds.includes(categoryId);
}

export function isStockEntryHidden(
  entry: { id: string; categoryId: string },
  visibility: ChestStockVisibility,
): boolean {
  return (
    visibility.hiddenItemIds.includes(entry.id) ||
    visibility.hiddenCategoryIds.includes(entry.categoryId)
  );
}

export function partitionItemsByVisibility<T extends { id: string; categoryId: string }>(
  items: T[],
  visibility: ChestStockVisibility,
): { visibleItems: T[]; hiddenItems: T[] } {
  const visibleItems: T[] = [];
  const hiddenItems: T[] = [];
  for (const item of items) {
    if (isStockEntryHidden(item, visibility)) {
      hiddenItems.push(item);
    } else {
      visibleItems.push(item);
    }
  }
  return { visibleItems, hiddenItems };
}

export function sumItemsWeightKg<T extends {
  stockToday: number | null;
  stockYesterday: number | null;
  weight?: number | null;
}>(
  items: T[],
  getEffectiveQty: (stockToday: number | null, stockYesterday: number | null) => number | null,
): number {
  return items.reduce((sum, item) => {
    const qty = getEffectiveQty(item.stockToday, item.stockYesterday);
    if (qty === null || item.weight == null) return sum;
    return sum + qty * item.weight;
  }, 0);
}

export function buildManualStockSavePayload<T extends {
  id: string;
  stockToday: number | null;
}>(
  visibleItems: T[],
  hiddenItems: T[],
  editedQuantitiesByItemId: Record<string, number | null>,
  getChangedEntries: (
    items: T[],
    edited: Record<string, number | null>,
  ) => { itemId: string; quantity: number }[],
): { itemId: string; quantity: number }[] {
  const changed = getChangedEntries(visibleItems, editedQuantitiesByItemId);
  const changedIds = new Set(changed.map((entry) => entry.itemId));

  const hiddenZeros = hiddenItems
    .filter((item) => item.stockToday !== 0 && !changedIds.has(item.id))
    .map((item) => ({ itemId: item.id, quantity: 0 }));

  return [...changed, ...hiddenZeros];
}
