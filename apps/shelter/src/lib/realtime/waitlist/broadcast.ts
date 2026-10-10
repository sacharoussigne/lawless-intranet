import { realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';
import { toWaitlistRealtimeEnvelope } from '@/lib/realtime/waitlist/envelope';
import type { WaitlistMutationMeta, WaitlistRealtimeEvent } from '@/lib/realtime/waitlist/types';

/** Tells the shelter's waitlist managers (topic checked in the realtime token) to refetch. */
export async function emitWaitlistChange(
  shelterId: string,
  event: Omit<WaitlistRealtimeEvent, 'originClientId' | 'type' | 'shelterId'> & {
    type?: 'waitlist';
  } = {},
  meta?: WaitlistMutationMeta,
): Promise<void> {
  await publishRealtime(
    [realtimeTopics.waitlist(shelterId)],
    toWaitlistRealtimeEnvelope({
      type: 'waitlist',
      shelterId,
      originClientId: meta?.originClientId,
      ...event,
    }),
    { logLabel: 'waitlist' },
  );
}
