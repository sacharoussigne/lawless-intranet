import type { BusinessPerson } from '@/lib/people/types';

export type PeopleSortColumn =
  | 'displayName'
  | 'discordUserId'
  | 'account'
  | 'accountNumber'
  | 'role'
  | 'employment'
  | 'salaryType';

export type SortDirection = 'asc' | 'desc';

/** Default order: present staff first, then people who left, then never hired; most recent first. */
export const DEFAULT_PEOPLE_SORT = { columnAccessor: 'employment', direction: 'desc' } as const;

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'fr', { sensitivity: 'base' });
}

/** Discord IDs are digit strings too long for a number: a longer ID is a bigger one. */
function compareDigits(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

function timeOf(date: Date | string | null): number {
  return date ? new Date(date).getTime() : 0;
}

/** Ascending: never hired, then left (oldest leaving first), then present (oldest hiring first). */
function compareEmployment(a: BusinessPerson, b: BusinessPerson): number {
  const tier = (person: BusinessPerson) =>
    person.employment.active ? 2 : person.employment.leftAt ? 1 : 0;
  const date = (person: BusinessPerson) =>
    timeOf(person.employment.active ? person.employment.since : person.employment.leftAt);
  return tier(a) - tier(b) || date(a) - date(b);
}

/** Value of a column where empty cells exist; null sorts last in both directions. */
function nullableValue(person: BusinessPerson, column: PeopleSortColumn): string | number | null {
  switch (column) {
    case 'account':
      return person.account?.name ?? null;
    case 'accountNumber':
      return person.accountNumber;
    case 'role':
      return person.role?.trim() || null;
    case 'salaryType':
      return person.salaryType?.label ?? null;
    default:
      return null;
  }
}

/** Compares two people for the « Personnes » table; ties fall back to the name. */
export function comparePeople(
  a: BusinessPerson,
  b: BusinessPerson,
  column: string,
  direction: SortDirection,
): number {
  const sign = direction === 'asc' ? 1 : -1;
  const byName = compareText(a.displayName, b.displayName);
  let result = 0;
  switch (column) {
    case 'displayName':
      return sign * byName;
    case 'discordUserId':
      return sign * compareDigits(a.discordUserId, b.discordUserId);
    case 'employment':
      result = sign * compareEmployment(a, b);
      break;
    case 'account':
    case 'accountNumber':
    case 'role':
    case 'salaryType': {
      const left = nullableValue(a, column);
      const right = nullableValue(b, column);
      if (left == null || right == null) {
        result = left == null ? (right == null ? 0 : 1) : -1;
      } else {
        result =
          sign *
          (typeof left === 'number' && typeof right === 'number'
            ? left - right
            : compareText(String(left), String(right)));
      }
      break;
    }
  }
  return result || byName;
}
