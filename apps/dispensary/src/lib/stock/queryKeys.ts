export const stockKeys = {
  all: (slug: string) => ['stock', slug] as const,
  items: (slug: string, chestId: string | null) =>
    [...stockKeys.all(slug), 'items', chestId] as const,
  checksSummary: (slug: string) =>
    [...stockKeys.all(slug), 'checks-summary'] as const,
  statsConsumption: (slug: string, fromKey: string, toKey: string) =>
    [...stockKeys.all(slug), 'stats', 'consumption', fromKey, toKey] as const,
  movementsPage: (slug: string, filters: Record<string, unknown>) =>
    [...stockKeys.all(slug), 'movements', 'page', filters] as const,
  reconciliation: (
    slug: string,
    itemId: string,
    chestFilter: string,
    fromKey: string,
    toKey: string,
  ) =>
    [...stockKeys.all(slug), 'movements', 'reconciliation', itemId, chestFilter, fromKey, toKey] as const,
};
