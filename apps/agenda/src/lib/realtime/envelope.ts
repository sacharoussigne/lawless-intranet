import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import type { AgendaRealtimeEvent } from '@/lib/realtime/types';

export type AgendaRealtimePayload = {
  agendaId?: string;
  eventId?: string;
};

export function toAgendaRealtimeEnvelope(
  event: AgendaRealtimeEvent,
): RealtimeEnvelope<AgendaRealtimePayload> {
  return {
    domain: REALTIME_DOMAIN.agenda,
    type: event.type,
    originClientId: event.originClientId,
    payload: {
      agendaId: event.agendaId,
      eventId: event.eventId,
    },
  };
}

export function fromAgendaRealtimeEnvelope(
  envelope: RealtimeEnvelope,
): AgendaRealtimeEvent {
  const payload = envelope.payload as AgendaRealtimePayload;
  return {
    type: envelope.type as AgendaRealtimeEvent['type'],
    agendaId: payload.agendaId,
    eventId: payload.eventId,
    originClientId: envelope.originClientId,
  };
}
