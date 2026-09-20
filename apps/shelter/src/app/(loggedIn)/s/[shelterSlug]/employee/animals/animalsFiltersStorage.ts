import type { AnimalFollowUpStatus, AnimalStatus } from '@/generated/prisma/client';

const STORAGE_KEY_PREFIX = 'shelter.animals.filters.v1';

const VALID_ANIMAL_STATUSES: AnimalStatus[] = [
  'in_care',
  'awaiting_adoption',
  'adopted',
  'deceased',
];

const VALID_FOLLOW_UP_STATUSES: AnimalFollowUpStatus[] = [
  'initial',
  'awaiting_recipient',
  'no_reply',
  'awaiting_shelter',
  'cancelled',
  'validated',
  'refused',
];

const VALID_SORT_ACCESSORS = [
  'lastFollowUpDate',
  'name',
  'arrivalDate',
  'status',
  'caseManagerName',
] as const;

export type AnimalsSortAccessor = (typeof VALID_SORT_ACCESSORS)[number];

export type PersistedAnimalsFilters = {
  nameFilter: string;
  speciesFilter: string | null;
  breedFilter: string | null;
  statusFilter: string | null;
  caseManagerFilter: string | null;
  followUpStatusFilter: string[];
  sortStatus: {
    columnAccessor: AnimalsSortAccessor;
    direction: 'asc' | 'desc';
  };
};

export const DEFAULT_ANIMALS_SORT: PersistedAnimalsFilters['sortStatus'] = {
  columnAccessor: 'lastFollowUpDate',
  direction: 'desc',
};

function storageKey(shelterSlug: string): string {
  return `${STORAGE_KEY_PREFIX}:${shelterSlug}`;
}

function isUuidOrStringId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 120;
}

function isNullableStringId(value: unknown): value is string | null {
  if (value === null) return true;
  return isUuidOrStringId(value);
}

function isValidAnimalStatus(value: unknown): value is AnimalStatus {
  return (
    typeof value === 'string' &&
    (VALID_ANIMAL_STATUSES as readonly string[]).includes(value)
  );
}

function isValidFollowUpStatusFilter(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === 'none') return true;
  return (VALID_FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}

function normalizeFollowUpStatusFilter(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(isValidFollowUpStatusFilter);
  }
  if (isValidFollowUpStatusFilter(value)) {
    return [value];
  }
  return [];
}

function isValidSortAccessor(value: unknown): value is AnimalsSortAccessor {
  return (
    typeof value === 'string' &&
    (VALID_SORT_ACCESSORS as readonly string[]).includes(value)
  );
}

function parsePersisted(raw: string): PersistedAnimalsFilters | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAnimalsFilters> & {
      followUpStatusFilter?: unknown;
    };
    const sort = parsed.sortStatus;
    return {
      nameFilter: typeof parsed.nameFilter === 'string' ? parsed.nameFilter : '',
      speciesFilter: isNullableStringId(parsed.speciesFilter) ? parsed.speciesFilter : null,
      breedFilter: isNullableStringId(parsed.breedFilter) ? parsed.breedFilter : null,
      statusFilter:
        parsed.statusFilter === null
          ? null
          : isValidAnimalStatus(parsed.statusFilter)
            ? parsed.statusFilter
            : null,
      caseManagerFilter: isNullableStringId(parsed.caseManagerFilter)
        ? parsed.caseManagerFilter
        : null,
      followUpStatusFilter: normalizeFollowUpStatusFilter(parsed.followUpStatusFilter),
      sortStatus:
        sort &&
        isValidSortAccessor(sort.columnAccessor) &&
        (sort.direction === 'asc' || sort.direction === 'desc')
          ? { columnAccessor: sort.columnAccessor, direction: sort.direction }
          : { ...DEFAULT_ANIMALS_SORT },
    };
  } catch {
    return null;
  }
}

export function readAnimalsFiltersPreference(
  shelterSlug: string,
): PersistedAnimalsFilters | null {
  try {
    const raw = window.localStorage.getItem(storageKey(shelterSlug));
    if (!raw) return null;
    return parsePersisted(raw);
  } catch {
    return null;
  }
}

export function writeAnimalsFiltersPreference(
  shelterSlug: string,
  filters: PersistedAnimalsFilters,
): void {
  try {
    window.localStorage.setItem(storageKey(shelterSlug), JSON.stringify(filters));
  } catch {
    // Ignore quota / private mode write failures.
  }
}
