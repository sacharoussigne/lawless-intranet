/**
 * - events / todos / eventTodos: data changed inside an agenda (refetch hints).
 * - agendas: the agenda list of the scope changed.
 * - access: the current user's agenda access changed.
 */
export type AgendaRealtimeEventType = 'events' | 'todos' | 'eventTodos' | 'agendas' | 'access';

export type AgendaRealtimeEvent = {
  type: AgendaRealtimeEventType;
  agendaId?: string;
  eventId?: string;
  originClientId?: string;
};
