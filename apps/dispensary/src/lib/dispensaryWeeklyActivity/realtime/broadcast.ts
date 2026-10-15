import { after } from 'next/server';
import { realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';
import { findUserIdByDiscordId } from '@lawless-intranet/auth-client/internal';
import { toWeeklyActivityRealtimeEnvelope } from '@/lib/dispensaryWeeklyActivity/realtime/envelope';
import type {
  WeeklyActivityMutationMeta,
  WeeklyActivityRealtimeEvent,
} from '@/lib/dispensaryWeeklyActivity/realtime/types';

/**
 * Rows from the Discord bot may only know the Discord account: find the linked
 * user so they still get their own updates (tenant-wide viewers get it anyway).
 */
async function resolveOwnerUserId(
  ownerUserId: string | null,
  ownerDiscordUserId: string,
): Promise<string | null> {
  if (ownerUserId) return ownerUserId;
  try {
    return await findUserIdByDiscordId(ownerDiscordUserId);
  } catch {
    return null;
  }
}

/** Tells `edit_all` viewers and the owner (topics checked in the realtime token) to refetch. */
export function emitWeeklyActivityChange(
  dispensaryId: string,
  event: Omit<WeeklyActivityRealtimeEvent, 'originClientId' | 'type'> & {
    type?: 'weeklyActivity';
  },
  meta?: WeeklyActivityMutationMeta,
): void {
  after(async () => {
    const ownerUserId = await resolveOwnerUserId(event.ownerUserId, event.ownerDiscordUserId);
    const topics = [realtimeTopics.weeklyActivity(dispensaryId)];
    if (ownerUserId) topics.push(realtimeTopics.weeklyActivityOfUser(dispensaryId, ownerUserId));

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
