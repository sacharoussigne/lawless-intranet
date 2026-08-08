import type { RealtimeEnvelope } from '@lawless-intranet/realtime';
import {
  broadcastDispensaryRealtime,
  dispensaryRealtimeChannelKey,
} from '@/lib/realtime/hub';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';
import { toWeeklyActivityRealtimeEnvelope } from '@/lib/dispensaryWeeklyActivity/realtime/envelope';

export function weeklyActivityRealtimeChannelKey(dispensaryId: string): string {
  return dispensaryRealtimeChannelKey(dispensaryId);
}

export function broadcastWeeklyActivityRealtime(
  channelKey: string,
  event: WeeklyActivityRealtimeEvent | RealtimeEnvelope,
): void {
  const envelope =
    'domain' in event && event.domain
      ? (event as RealtimeEnvelope)
      : toWeeklyActivityRealtimeEnvelope(event as WeeklyActivityRealtimeEvent);
  broadcastDispensaryRealtime(channelKey, envelope);
}
