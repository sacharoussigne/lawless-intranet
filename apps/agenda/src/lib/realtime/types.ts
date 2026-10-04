/**
 * - events / todos / eventTodos: data changed inside an agenda (refetch hints).
 * - agendas: the agenda list of a scope changed (create, rename, delete, members).
 * - access: the receiving user's agenda access changed (refresh realtime token).
 */
export type AgendaRealtimeEventType = 'events' | 'todos' | 'eventTodos' | 'agendas' | 'access';

export type AgendaRealtimeEvent = {
  type: AgendaRealtimeEventType;
  agendaId?: string;
  eventId?: string;
  originClientId?: string;
};

export type AgendaMutationMeta = {
  originClientId?: string;
};
