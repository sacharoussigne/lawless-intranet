import { describe, expect, it } from 'vitest';
import type { ItemRecord } from '@lawless-intranet/types';
import { tenantRoutes } from '@/types/routes';
import {
  letterConversationHref,
  matchByName,
  matchManagementCandidates,
  matchPaletteItems,
  PALETTE_ENTITY_LIMIT,
  PALETTE_MANAGEMENT_LIMIT,
} from './entities';

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

describe('matchByName', () => {
  const names = ['Trousse de soin', 'Grande trousse', 'Bandage', 'Trousse à outils'];
  const match = (query: string, limit = 10) => matchByName(names, query, (name) => name, limit);

  it('needs every word, ignores case and accents, names starting with the query first', () => {
    expect(match('TROUSSE')).toEqual(['Trousse à outils', 'Trousse de soin', 'Grande trousse']);
    expect(match('trousse outil')).toEqual(['Trousse à outils']);
    expect(match('  ')).toEqual([]);
  });

  it('keeps the limit', () => {
    expect(match('trousse', 2)).toHaveLength(2);
  });
});

describe('matchManagementCandidates', () => {
  const m = tenantRoutes('sd').management;

  it('opens the edit window, kind in the detail, alias searched but hidden', () => {
    const hits = matchManagementCandidates(
      [
        { kind: 'Objet', id: 'i1', name: 'Trousse de soin', detail: 'Remèdes', href: m.items(undefined, 'i1') },
        { kind: 'Personne', id: '1234', name: 'George Hale', alias: '1234', href: m.people('1234') },
      ],
      '1234',
    );
    expect(hits).toEqual([
      { type: 'management', id: 'Personne:1234', label: 'George Hale', detail: 'Personne', href: '/sd/management/people?edit=1234' },
    ]);
    expect(matchManagementCandidates([{ kind: 'Objet', id: 'i1', name: 'Trousse', detail: 'Remèdes', href: m.items(undefined, 'i1') }], 'trousse')[0])
      .toMatchObject({ detail: 'Objet · Remèdes', href: '/sd/management/items?edit=i1' });
  });

  it('keeps a few hits across kinds', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ kind: 'Coffre', id: `${index}`, name: `Coffre ${index}`, href: '' }));
    expect(matchManagementCandidates(many, 'coffre')).toHaveLength(PALETTE_MANAGEMENT_LIMIT);
  });
});

describe('management edit links', () => {
  const m = tenantRoutes('sd').management;

  it('keeps the tab and adds the entity', () => {
    expect(m.companies('groups', 'g1')).toBe('/sd/management/companies?tab=groups&edit=g1');
    expect(m.items('categories', 'c1')).toBe('/sd/management/items?tab=categories&edit=c1');
    expect(m.chests('ch1')).toBe('/sd/management/chests?edit=ch1');
    expect(m.chests()).toBe('/sd/management/chests');
    expect(m.items()).toBe('/sd/management/items');
  });
});
