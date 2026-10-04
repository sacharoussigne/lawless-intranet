/**
 * React Query keys for agenda data. Every key starts with the host scope key
 * (e.g. dispensarySlug) so tenants never share cache entries.
 *
 * All event lists (calendar ranges, header upcoming events) live under
 * `eventsAll`: one invalidation refreshes every visible event list, including
 * participant events coming from other agendas.
 */
export const agendaKeys = {
  all: (scopeKey: string) => ['agenda', scopeKey] as const,
  eventsAll: (scopeKey: string) => ['agenda', scopeKey, 'events'] as const,
  events: (
    scopeKey: string,
    agendaId: string | null,
    range: { rangeStart: string; rangeEnd: string },
  ) =>
    [
      'agenda',
      scopeKey,
      'events',
      'calendar',
      agendaId ?? 'participant',
      range.rangeStart,
      range.rangeEnd,
    ] as const,
  upcoming: (scopeKey: string, range: { rangeStart: string; rangeEnd: string }) =>
    ['agenda', scopeKey, 'events', 'upcoming', range.rangeStart, range.rangeEnd] as const,
  todos: (scopeKey: string, agendaId: string) => ['agenda', scopeKey, 'todos', agendaId] as const,
};
