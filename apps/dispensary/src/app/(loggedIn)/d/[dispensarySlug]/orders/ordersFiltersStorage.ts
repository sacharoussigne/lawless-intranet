import type { OrdersPageFilters } from '@/lib/orders/queryKeys';

const STORAGE_KEY_PREFIX = 'orders.filters.v2';
const LEGACY_STORAGE_KEY_PREFIX = 'orders.filters.v1';

const VALID_STATUSES = [
  'DRAFT',
  'LETTER_SENT',
  'PROCESSING',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;

export type PersistedOrdersFilters = Pick<
  OrdersPageFilters,
  'status' | 'type' | 'search' | 'pageSize' | 'createdAtFrom' | 'createdAtTo'
>;

function storageKey(dispensarySlug: string): string {
  return `${STORAGE_KEY_PREFIX}:${dispensarySlug}`;
}

function legacyStorageKey(dispensarySlug: string): string {
  return `${LEGACY_STORAGE_KEY_PREFIX}:${dispensarySlug}`;
}

function isValidStatusValue(value: unknown): value is string {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

function normalizeStatuses(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(isValidStatusValue);
  }
  if (isValidStatusValue(value)) {
    return [value];
  }
  return [];
}

function isValidType(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  return value === 'INCOMING' || value === 'OUTGOING';
}

function parsePersisted(raw: string): PersistedOrdersFilters | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedOrdersFilters> & {
      status?: unknown;
    };
    return {
      status: normalizeStatuses(parsed.status),
      type: isValidType(parsed.type) ? parsed.type : null,
      search: typeof parsed.search === 'string' ? parsed.search : '',
      pageSize:
        typeof parsed.pageSize === 'number' && parsed.pageSize >= 1 && parsed.pageSize <= 50
          ? parsed.pageSize
          : 10,
      createdAtFrom:
        typeof parsed.createdAtFrom === 'string' || parsed.createdAtFrom === null
          ? (parsed.createdAtFrom ?? null)
          : null,
      createdAtTo:
        typeof parsed.createdAtTo === 'string' || parsed.createdAtTo === null
          ? (parsed.createdAtTo ?? null)
          : null,
    };
  } catch {
    return null;
  }
}

export function readOrdersFiltersPreference(
  dispensarySlug: string,
): PersistedOrdersFilters | null {
  try {
    const raw = window.localStorage.getItem(storageKey(dispensarySlug));
    if (raw) return parsePersisted(raw);

    const legacyRaw = window.localStorage.getItem(legacyStorageKey(dispensarySlug));
    if (!legacyRaw) return null;
    const migrated = parsePersisted(legacyRaw);
    if (migrated) {
      writeOrdersFiltersPreference(dispensarySlug, migrated);
      window.localStorage.removeItem(legacyStorageKey(dispensarySlug));
    }
    return migrated;
  } catch {
    return null;
  }
}

export function writeOrdersFiltersPreference(
  dispensarySlug: string,
  filters: PersistedOrdersFilters,
): void {
  try {
    window.localStorage.setItem(storageKey(dispensarySlug), JSON.stringify(filters));
  } catch {
    // Ignore quota / private mode write failures.
  }
}
