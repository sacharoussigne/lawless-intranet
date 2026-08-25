import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import type { WaitlistRealtimeEvent } from './types';

export type WaitlistRealtimePayload = {
  shelterId: string;
};

export function toWaitlistRealtimeEnvelope(
  event: WaitlistRealtimeEvent,
): RealtimeEnvelope<WaitlistRealtimePayload> {
  return {
    domain: REALTIME_DOMAIN.waitlist,
    type: event.type,
    originClientId: event.originClientId,
    payload: {
      shelterId: event.shelterId,
    },
  };
}

export function fromWaitlistRealtimeEnvelope(
  envelope: RealtimeEnvelope,
): WaitlistRealtimeEvent {
  const payload = envelope.payload as WaitlistRealtimePayload;
  return {
    type: 'waitlist',
    shelterId: payload.shelterId,
    originClientId: envelope.originClientId,
  };
}
