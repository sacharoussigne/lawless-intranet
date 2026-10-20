import { after } from 'next/server';
import { realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';
import { accountIdOfDiscord } from '@/lib/people/accountLinks';
import { toWeeklyActivityRealtimeEnvelope } from '@/lib/businessWeeklyActivity/realtime/envelope';
import type {
  WeeklyActivityMutationMeta,
  WeeklyActivityRealtimeEvent,
} from '@/lib/businessWeeklyActivity/realtime/types';

/**
 * The owner is the account holding the row's Discord id today (cached lookup);
 * the stored `userId` is only used when auth does not answer.
 */
async function resolveOwnerUserId(
  ownerUserId: string | null,
  ownerDiscordUserId: string,
): Promise<string | null> {
  const current = await accountIdOfDiscord(ownerDiscordUserId);
  return current === undefined ? ownerUserId : current;
}

/** Tells `edit_all` viewers and the owner (topics checked in the realtime token) to refetch. */
export function emitWeeklyActivityChange(
  businessId: string,
  event: Omit<WeeklyActivityRealtimeEvent, 'originClientId' | 'type'> & {
    type?: 'weeklyActivity';
  },
  meta?: WeeklyActivityMutationMeta,
): void {
  after(async () => {
    const ownerUserId = await resolveOwnerUserId(event.ownerUserId, event.ownerDiscordUserId);
    const topics = [realtimeTopics.weeklyActivity(businessId)];
    if (ownerUserId) topics.push(realtimeTopics.weeklyActivityOfUser(businessId, ownerUserId));

    await publishRealtime(
      topics,
      toWeeklyActivityRealtimeEnvelope({
        type: 'weeklyActivity',
        activityId: event.activityId,
        ownerUserId: event.ownerUserId,
        ownerDiscordUserId: event.ownerDiscordUserId,
        periodStart: event.periodStart,
        periodEnd: event.periodEnd,
        originClientId: meta?.originClientId,
      }),
      { logLabel: 'weekly-activity' },
    );
  });
}

export function activityToWeeklyActivityRealtimePayload(
  activity: {
    id: string;
    userId: string | null;
    discordUserId: string;
    periodStart: Date;
    periodEnd: Date;
  },
): Omit<WeeklyActivityRealtimeEvent, 'originClientId' | 'type'> {
  return {
    activityId: activity.id,
    ownerUserId: activity.userId,
    ownerDiscordUserId: activity.discordUserId,
    periodStart: activity.periodStart.toISOString(),
    periodEnd: activity.periodEnd.toISOString(),
  };
}
