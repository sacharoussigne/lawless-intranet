import { publishAgendaRealtime } from '@/lib/realtime/pgBus';
import type { AgendaMutationMeta, AgendaRealtimeEvent } from '@/lib/realtime/types';

export async function broadcastAgendaChange(
  scopeType: string,
  scopeId: string,
  event: Omit<AgendaRealtimeEvent, 'originClientId'>,
  meta?: AgendaMutationMeta,
): Promise<void> {
  await publishAgendaRealtime(scopeType, scopeId, {
    ...event,
    originClientId: meta?.originClientId,
  });
}

export async function emitAgendaEventsChange(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  meta?: AgendaMutationMeta,
): Promise<void> {
  await broadcastAgendaChange(scopeType, scopeId, { type: 'events', agendaId }, meta);
}

export async function emitAgendaTodosChange(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  meta?: AgendaMutationMeta,
): Promise<void> {
  await broadcastAgendaChange(scopeType, scopeId, { type: 'todos', agendaId }, meta);
}

export async function emitAgendaEventTodosChange(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  eventId: string,
  meta?: AgendaMutationMeta,
): Promise<void> {
  await broadcastAgendaChange(
    scopeType,
    scopeId,
    { type: 'eventTodos', agendaId, eventId },
    meta,
  );
}
