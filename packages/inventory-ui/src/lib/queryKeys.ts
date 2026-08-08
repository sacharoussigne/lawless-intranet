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

export const DEFAULT_STALE_TIME_MS = 30_000;
