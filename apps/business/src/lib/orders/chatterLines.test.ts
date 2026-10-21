import { describe, expect, it } from 'vitest';
import type { OrderEventRecord } from '@lawless-intranet/types';
import { describeOrderChange, describeOrderEventAction } from './chatterLines';

const people = { u1: { userId: 'u1', name: 'Sacha', image: null } };

function event(partial: Partial<OrderEventRecord>): OrderEventRecord {
  return {
    id: 'e1',
    orderId: 'o1',
    kind: 'UPDATED',
    actorUserId: 'u1',
    body: null,
    changes: null,
    createdAt: '2026-10-21T10:00:00.000Z',
    editedAt: null,
    ...partial,
  };
}

describe('describeOrderChange', () => {
  it('describes status, items and price changes', () => {
    expect(describeOrderChange({ field: 'status', from: 'DRAFT', to: 'READY' }, people)).toBe(
      'Statut : Brouillon → Prête',
    );
    expect(
      describeOrderChange(
        {
          field: 'items',
          added: [{ itemId: 'a', name: 'Bandage', quantity: 2 }],
          removed: [{ itemId: 'b', name: 'Tonique', quantity: 1 }],
          changed: [{ itemId: 'c', name: 'Morphine', from: 1, to: 3 }],
        },
        people,
      ),
    ).toBe('Articles : +2 Bandage, Morphine 1 → 3, −Tonique');
    expect(describeOrderChange({ field: 'price', from: 4, to: 6, manual: false }, people)).toBe(
      'Prix : 4.00 $ → 6.00 $ (auto)',
    );
    expect(describeOrderChange({ field: 'price', from: 4, to: 4, manual: true }, people)).toBe(
      'Prix : passé en manuel (4.00 $)',
    );
  });

  it('names responsibles, including former members', () => {
    expect(describeOrderChange({ field: 'responsible', from: null, to: 'u1' }, people)).toBe(
      'Responsable : Aucun → Sacha',
    );
    expect(describeOrderChange({ field: 'responsible', from: 'gone', to: null }, people)).toBe(
      'Responsable : Ancien membre → Aucun',
    );
  });
});

describe('describeOrderEventAction', () => {
  it('tells a copy from its source', () => {
    const change = { field: 'duplicate' as const, orderId: 'o2', orderName: 'x' };
    expect(
      describeOrderEventAction(event({ kind: 'DUPLICATED', changes: [{ ...change, direction: 'to' }] })),
    ).toBe('a dupliqué la commande');
    expect(
      describeOrderEventAction(event({ kind: 'DUPLICATED', changes: [{ ...change, direction: 'from' }] })),
    ).toBe('a créé cette copie');
  });
});
