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
