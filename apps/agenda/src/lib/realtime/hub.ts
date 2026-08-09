import {
  createRealtimeHub,
  type RealtimeEnvelope,
} from '@lawless-intranet/realtime/server';
import { toAgendaRealtimeEnvelope } from '@/lib/realtime/envelope';
import type { AgendaRealtimeEvent } from '@/lib/realtime/types';

const hub = createRealtimeHub<RealtimeEnvelope>({
  globalKey: '__agendaRealtimeChannels',
});

export function subscribeAgendaRealtime(
  channelKey: string,
  send: (chunk: string) => void,
): () => void {
  return hub.subscribe(channelKey, send);
}

export function broadcastAgendaRealtime(
  channelKey: string,
  event: AgendaRealtimeEvent | RealtimeEnvelope,
): void {
  const envelope =
    'payload' in event && 'domain' in event
      ? (event as RealtimeEnvelope)
      : toAgendaRealtimeEnvelope(event as AgendaRealtimeEvent);
  hub.broadcast(channelKey, envelope);
}

export function getAgendaRealtimeSubscriberCount(channelKey: string): number {
  return hub.subscriberCount(channelKey);
}
