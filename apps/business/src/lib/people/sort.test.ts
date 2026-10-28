import { describe, expect, it } from 'vitest';
import { comparePeople } from '@/lib/people/sort';
import type { BusinessPerson } from '@/lib/people/types';

function person(name: string, overrides: Partial<BusinessPerson> = {}): BusinessPerson {
  return {
    discordUserId: '1',
    displayName: name,
    fixedDisplayName: null,
    lastDisplayName: name,
    role: null,
    accountNumber: null,
    salaryType: null,
    account: null,
    intranetRoles: null,
    employment: { active: false, since: null, leftAt: null, stays: 0 },
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const present = (name: string, since: string) =>
  person(name, { employment: { active: true, since: new Date(since), leftAt: null, stays: 1 } });
const left = (name: string, leftAt: string) =>
  person(name, { employment: { active: false, since: null, leftAt: new Date(leftAt), stays: 1 } });

function names(people: BusinessPerson[], column: string, direction: 'asc' | 'desc'): string[] {
  return [...people].sort((a, b) => comparePeople(a, b, column, direction)).map((p) => p.displayName);
}

describe('comparePeople', () => {
  const people = [
    left('Left old', '2026-02-01'),
    person('Never B'),
    present('Present old', '2026-01-01'),
    left('Left recent', '2026-05-01'),
    person('Never A'),
    present('Present recent', '2026-06-01'),
  ];

  it('puts present staff, then people who left, then the rest, most recent first', () => {
    expect(names(people, 'employment', 'desc')).toEqual([
      'Present recent',
      'Present old',
      'Left recent',
      'Left old',
      'Never A',
      'Never B',
    ]);
  });

  it('reverses the employment order, ties still by name', () => {
    expect(names(people, 'employment', 'asc')).toEqual([
      'Never A',
      'Never B',
      'Left old',
      'Left recent',
      'Present old',
      'Present recent',
    ]);
  });

  it('keeps empty cells last in both directions', () => {
    const rows = [person('No number'), person('Two', { accountNumber: 2 }), person('Ten', { accountNumber: 10 })];
    expect(names(rows, 'accountNumber', 'asc')).toEqual(['Two', 'Ten', 'No number']);
    expect(names(rows, 'accountNumber', 'desc')).toEqual(['Ten', 'Two', 'No number']);
  });

  it('sorts names without case or accents', () => {
    expect(names([person('émile'), person('Zoé'), person('adam')], 'displayName', 'asc')).toEqual([
      'adam',
      'émile',
      'Zoé',
    ]);
  });

  it('sorts Discord IDs as numbers', () => {
    const rows = [person('A', { discordUserId: '900' }), person('B', { discordUserId: '1000' })];
    expect(names(rows, 'discordUserId', 'asc')).toEqual(['A', 'B']);
  });
});
