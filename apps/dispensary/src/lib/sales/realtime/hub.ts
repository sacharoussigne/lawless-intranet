import type { RealtimeEnvelope } from '@lawless-intranet/realtime';
import {
  broadcastDispensaryRealtime,
  dispensaryRealtimeChannelKey,
} from '@/lib/realtime/hub';
import { toWeeklySalesRealtimeEnvelope } from '@/lib/sales/realtime/envelope';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';

export function weeklySalesRealtimeChannelKey(dispensaryId: string): string {
  return dispensaryRealtimeChannelKey(dispensaryId);
}

export function broadcastWeeklySalesRealtime(
  channelKey: string,
  event: WeeklySalesRealtimeEvent | RealtimeEnvelope,
): void {
  const envelope =
    'payload' in event && 'domain' in event
      ? (event as RealtimeEnvelope)
      : toWeeklySalesRealtimeEnvelope(event as WeeklySalesRealtimeEvent);
  broadcastDispensaryRealtime(channelKey, envelope);
}
