import { describe, expect, it } from 'vitest';
import {
  EMPTY_CHEST_STOCK_VISIBILITY,
  buildManualStockSavePayload,
  isCategoryHidden,
  isStockEntryHidden,
  partitionItemsByVisibility,
  sumItemsWeightKg,
  type ChestStockVisibility,
} from './stockVisibility';

const normalizeQuantity = (quantity: number | null | undefined): number =>
  quantity == null ? 0 : quantity;

const visibility = (partial: Partial<ChestStockVisibility> = {}): ChestStockVisibility => ({
  ...EMPTY_CHEST_STOCK_VISIBILITY,
  ...partial,
});

describe('isStockEntryHidden', () => {
  it('returns false when nothing is hidden', () => {
    expect(isStockEntryHidden({ id: 'i1', categoryId: 'c1' }, visibility())).toBe(false);
  });

  it('returns true when the item is hidden', () => {
    expect(
      isStockEntryHidden({ id: 'i1', categoryId: 'c1' }, visibility({ hiddenItemIds: ['i1'] })),
    ).toBe(true);
  });

  it('returns true when the category is hidden', () => {
    expect(
      isStockEntryHidden({ id: 'i1', categoryId: 'c1' }, visibility({ hiddenCategoryIds: ['c1'] })),
    ).toBe(true);
  });
});

describe('isCategoryHidden', () => {
  it('detects hidden categories', () => {
    expect(isCategoryHidden('c1', visibility({ hiddenCategoryIds: ['c1'] }))).toBe(true);
    expect(isCategoryHidden('c2', visibility({ hiddenCategoryIds: ['c1'] }))).toBe(false);
  });
});

describe('partitionItemsByVisibility', () => {
  it('splits visible and hidden items', () => {
    const items = [
      { id: 'i1', categoryId: 'c1' },
      { id: 'i2', categoryId: 'c1' },
      { id: 'i3', categoryId: 'c2' },
    ];

    const result = partitionItemsByVisibility(
      items,
      visibility({ hiddenItemIds: ['i2'], hiddenCategoryIds: ['c2'] }),
    );

    expect(result.visibleItems.map((i) => i.id)).toEqual(['i1']);
    expect(result.hiddenItems.map((i) => i.id)).toEqual(['i2', 'i3']);
  });
});

describe('sumItemsWeightKg', () => {
  it('sums effective qty * weight and ignores nulls', () => {
    const total = sumItemsWeightKg(
      [
        { stockToday: 2, stockYesterday: 1, weight: 0.5 },
        { stockToday: null, stockYesterday: 4, weight: 1 },
        { stockToday: 3, stockYesterday: null, weight: null },
        { stockToday: null, stockYesterday: null, weight: 2 },
      ],
      (today, yesterday) => today ?? yesterday ?? null,
    );

    expect(total).toBe(2 * 0.5 + 4 * 1);
  });

  it('excludes hidden items when only visible items are passed', () => {
    const visible = [
      { stockToday: 10, stockYesterday: null, weight: 0.2 },
    ];
    expect(sumItemsWeightKg(visible, (t, y) => t ?? y ?? null)).toBe(2);
  });
});

describe('buildManualStockSavePayload', () => {
  type Item = { id: string; stockToday: number | null };

  const getChangedEntries = (
    items: Item[],
    edited: Record<string, number | null>,
  ) =>
    items
      .map((item) => {
        const normalized = normalizeQuantity(edited[item.id]);
        if ((item.stockToday ?? null) === normalized) return null;
        return { itemId: item.id, quantity: normalized };
      })
      .filter((entry): entry is { itemId: string; quantity: number } => entry !== null);

  it('includes visible changes and zeros hidden items', () => {
    const visible: Item[] = [
      { id: 'v1', stockToday: 5 },
      { id: 'v2', stockToday: null },
    ];
    const hidden: Item[] = [
      { id: 'h1', stockToday: 3 },
      { id: 'h2', stockToday: 0 },
      { id: 'h3', stockToday: null },
    ];

    const payload = buildManualStockSavePayload(
      visible,
      hidden,
      { v1: 5, v2: 7 },
      getChangedEntries,
    );

    expect(payload).toEqual([
      { itemId: 'v2', quantity: 7 },
      { itemId: 'h1', quantity: 0 },
      { itemId: 'h3', quantity: 0 },
    ]);
  });

  it('still returns hidden zeros when no visible changes', () => {
    const payload = buildManualStockSavePayload(
      [{ id: 'v1', stockToday: 1 }],
      [{ id: 'h1', stockToday: 4 }],
      { v1: 1 },
      getChangedEntries,
    );

    expect(payload).toEqual([{ itemId: 'h1', quantity: 0 }]);
  });
});
