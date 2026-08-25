import {
  createRealtimeHub,
  type RealtimeEnvelope,
} from '@lawless-intranet/realtime/server';

export function shelterRealtimeChannelKey(shelterId: string): string {
  return `shelter:${shelterId}`;
}

const hub = createRealtimeHub<RealtimeEnvelope>({
  globalKey: '__shelterRealtimeChannels',
});

export const subscribeShelterRealtime = hub.subscribe;
export const broadcastShelterRealtime = hub.broadcast;
export const getShelterRealtimeSubscriberCount = hub.subscriberCount;
