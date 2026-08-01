import type { OrdersPageFilters } from '@/lib/orders/queryKeys';

const STORAGE_KEY_PREFIX = 'orders.filters.v1';

export type PersistedOrdersFilters = Pick<
  OrdersPageFilters,
  'status' | 'type' | 'search' | 'pageSize' | 'createdAtFrom' | 'createdAtTo'
>;

function storageKey(dispensarySlug: string): string {
  return `${STORAGE_KEY_PREFIX}:${dispensarySlug}`;
}

function isValidStatus(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  return [
    'DRAFT',
    'LETTER_SENT',
    'PROCESSING',
    'READY',
    'COMPLETED',
    'CANCELLED',
  ].includes(value);
}

function isValidType(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  return value === 'INCOMING' || value === 'OUTGOING';
}

export function readOrdersFiltersPreference(
  dispensarySlug: string,
): PersistedOrdersFilters | null {
  try {
    const raw = window.localStorage.getItem(storageKey(dispensarySlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedOrdersFilters>;
    return {
      status: isValidStatus(parsed.status) ? parsed.status : null,
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
