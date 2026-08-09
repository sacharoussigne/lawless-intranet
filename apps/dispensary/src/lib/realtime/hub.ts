import {
  createRealtimeHub,
  type RealtimeEnvelope,
} from '@lawless-intranet/realtime/server';
import { isDispensaryRealtimeVisibleToViewer } from '@/lib/realtime/visibility';
import type { DispensaryRealtimeViewerFilter } from '@/lib/realtime/types';

export function dispensaryRealtimeChannelKey(dispensaryId: string): string {
  return `dispensary:${dispensaryId}`;
}

const hub = createRealtimeHub<RealtimeEnvelope, DispensaryRealtimeViewerFilter>({
  globalKey: '__dispensaryRealtimeChannels',
  isVisible: isDispensaryRealtimeVisibleToViewer,
});

export const subscribeDispensaryRealtime = hub.subscribe;
export const broadcastDispensaryRealtime = hub.broadcast;
export const getDispensaryRealtimeSubscriberCount = hub.subscriberCount;
