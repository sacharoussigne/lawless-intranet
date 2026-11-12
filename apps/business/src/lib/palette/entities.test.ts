import { describe, expect, it } from 'vitest';
import type { ItemRecord } from '@lawless-intranet/types';
import { letterConversationHref, matchPaletteItems, PALETTE_ENTITY_LIMIT } from './entities';

function item(name: string, overrides: Partial<ItemRecord> = {}): ItemRecord {
  return {
    id: name,
    scopeType: 'business',
    scopeId: 'b',
    name,
    description: null,
    minimalQuantity: 0,
    isCraftable: false,
    isEnabled: true,
    canBeSold: false,
    price: null,
    weight: null,
    categoryId: 'c',
    companyGroupId: null,
    order: 0,
    createdAt: '',
    updatedAt: '',
    category: { id: 'c', name: 'Remèdes', color: 'sage', order: 0 },
    companyGroup: null,
    ...overrides,
  };
}

describe('matchPaletteItems', () => {
  const items = [item('Bandage'), item('Élixir de santé'), item('Petit bandage'), item('Laudanum', { isEnabled: false })];

  it('ignores case and accents, names starting with the query first', () => {
    expect(matchPaletteItems(items, 'BANDAGE', 'sd').map((hit) => hit.label)).toEqual(['Bandage', 'Petit bandage']);
    expect(matchPaletteItems(items, 'elixir sante', 'sd').map((hit) => hit.label)).toEqual(['Élixir de santé']);
  });

  it('skips disabled items and opens the item search on the item', () => {
    expect(matchPaletteItems(items, 'laudanum', 'sd')).toEqual([]);
    expect(matchPaletteItems(items, 'bandage', 'sd')[0]).toMatchObject({
      type: 'item',
      detail: 'Remèdes',
      href: '/sd/employee/search-items?item=Bandage',
    });
  });

  it('keeps a few hits', () => {
    const many = Array.from({ length: 12 }, (_, index) => item(`Bandage ${index}`));
    expect(matchPaletteItems(many, 'bandage', 'sd')).toHaveLength(PALETTE_ENTITY_LIMIT);
  });
});

describe('letterConversationHref', () => {
  it('opens the contact, and the letter when given', () => {
    expect(letterConversationHref('sd', { boxId: 'b1', correspondentId: 'c1' })).toBe('/sd/employee/letters?box=b1&c=c1');
    expect(letterConversationHref('sd', { boxId: 'b1', correspondentId: 'c1', letterId: 'l1', archived: true })).toBe(
      '/sd/employee/letters?box=b1&c=c1&l=l1&archived=1',
    );
  });
});
