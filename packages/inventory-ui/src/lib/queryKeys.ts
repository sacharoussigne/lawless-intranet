export const stockKeys = {
  all: (scopeKey: string) => ['stock', scopeKey] as const,
  items: (scopeKey: string, chestId: string | null) =>
    [...stockKeys.all(scopeKey), 'items', chestId] as const,
  checksSummary: (scopeKey: string) =>
    [...stockKeys.all(scopeKey), 'checks-summary'] as const,
  lastStockDays: (scopeKey: string) =>
    [...stockKeys.all(scopeKey), 'last-stock-days'] as const,
  visibility: (scopeKey: string, chestId: string) =>
    [...stockKeys.all(scopeKey), 'visibility', chestId] as const,
};

/**
 * Short on purpose: the browser QueryClient outlives client navigations and
 * `initialData` from SSR is ignored once a key is cached, so returning to a
 * page must refetch. 5 s only avoids a duplicate fetch right after SSR.
 */
export const DEFAULT_STALE_TIME_MS = 5_000;
