import {
  broadcastShelterRealtime,
  shelterRealtimeChannelKey,
} from '@/lib/realtime/hub';
import { toWaitlistRealtimeEnvelope } from '@/lib/realtime/waitlist/envelope';
import type { WaitlistMutationMeta, WaitlistRealtimeEvent } from '@/lib/realtime/waitlist/types';

export async function emitWaitlistChange(
  shelterId: string,
  event: Omit<WaitlistRealtimeEvent, 'originClientId' | 'type' | 'shelterId'> & {
    type?: 'waitlist';
  } = {},
  meta?: WaitlistMutationMeta,
): Promise<void> {
  broadcastShelterRealtime(
    shelterRealtimeChannelKey(shelterId),
    toWaitlistRealtimeEnvelope({
      type: 'waitlist',
      shelterId,
      originClientId: meta?.originClientId,
      ...event,
    }),
  );
}
