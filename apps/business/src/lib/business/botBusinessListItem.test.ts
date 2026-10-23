import { describe, expect, it } from 'vitest';
import { toBotBusinessListItem } from '@/lib/business/botBusinessListItem';

const row = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'saint-denis',
  name: 'Dispensaire',
  type: 'DISPENSARY' as const,
};

describe('toBotBusinessListItem', () => {
  it('uses the name from the settings and the label of the type', () => {
    expect(toBotBusinessListItem({ ...row, settings: { businessName: ' Saint-Denis ' } })).toEqual({
      id: row.id,
      slug: 'saint-denis',
      type: 'DISPENSARY',
      typeLabel: 'Dispensaire',
      name: 'Saint-Denis',
    });
  });

  it('falls back to the business name without settings or with an empty one', () => {
    expect(toBotBusinessListItem({ ...row, settings: null }).name).toBe('Dispensaire');
    expect(toBotBusinessListItem({ ...row, settings: { businessName: '  ' } }).name).toBe('Dispensaire');
  });
});
