import { describe, expect, it } from 'vitest';
import { diffOrderSnapshots, resolvePriceMode, type OrderSnapshot } from './orderChanges';

const base: OrderSnapshot = {
  name: 'ferme-0001',
  status: 'DRAFT',
  type: 'OUTGOING',
  details: null,
  price: 4,
  priceManual: false,
  responsibleUserId: null,
  items: [
    { itemId: 'a', name: 'Bandage', quantity: 2 },
    { itemId: 'b', name: 'Morphine', quantity: 1 },
  ],
};

describe('diffOrderSnapshots', () => {
  it('returns nothing when the order did not change', () => {
    expect(diffOrderSnapshots(base, { ...base, items: [...base.items] })).toEqual([]);
  });

  it('lists status, items and price changes', () => {
    const after: OrderSnapshot = {
      ...base,
      status: 'READY',
      price: 7,
      items: [
        { itemId: 'b', name: 'Morphine', quantity: 3 },
        { itemId: 'c', name: 'Tonique', quantity: 1 },
      ],
    };
    expect(diffOrderSnapshots(base, after)).toEqual([
      { field: 'status', from: 'DRAFT', to: 'READY' },
      {
        field: 'items',
        added: [{ itemId: 'c', name: 'Tonique', quantity: 1 }],
        removed: [{ itemId: 'a', name: 'Bandage', quantity: 2 }],
        changed: [{ itemId: 'b', name: 'Morphine', from: 1, to: 3 }],
      },
      { field: 'price', from: 4, to: 7, manual: false },
    ]);
  });

  it('records a switch of price mode even when the amount is the same', () => {
    expect(diffOrderSnapshots(base, { ...base, priceManual: true })).toEqual([
      { field: 'price', from: 4, to: 4, manual: true },
    ]);
  });

  it('records a new responsible', () => {
    expect(diffOrderSnapshots(base, { ...base, responsibleUserId: 'u1' })).toEqual([
      { field: 'responsible', from: null, to: 'u1' },
    ]);
  });
});

describe('resolvePriceMode', () => {
  const current = { currentManual: false, currentPrice: 4, catalogTotal: 6 };

  it('follows the catalog in automatic mode, whatever price is sent', () => {
    expect(resolvePriceMode({ ...current, requestedManual: undefined, requestedPrice: 10 })).toEqual({
      price: 6,
      priceManual: false,
    });
  });

  it('keeps a hand-typed price', () => {
    expect(resolvePriceMode({ ...current, requestedManual: true, requestedPrice: 10 })).toEqual({
      price: 10,
      priceManual: true,
    });
  });

  it('keeps the stored manual price when none is sent', () => {
    expect(
      resolvePriceMode({ currentManual: true, currentPrice: 9, catalogTotal: 6, requestedManual: undefined, requestedPrice: undefined }),
    ).toEqual({ price: 9, priceManual: true });
  });

  it('goes back to automatic when asked, or when the manual price is empty', () => {
    expect(
      resolvePriceMode({ currentManual: true, currentPrice: 9, catalogTotal: 6, requestedManual: false, requestedPrice: 9 }),
    ).toEqual({ price: 6, priceManual: false });
    expect(resolvePriceMode({ ...current, requestedManual: true, requestedPrice: null })).toEqual({
      price: 6,
      priceManual: false,
    });
  });
});
