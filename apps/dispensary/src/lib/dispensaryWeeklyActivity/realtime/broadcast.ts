import { publishWeeklyActivityRealtime } from '@/lib/dispensaryWeeklyActivity/realtime/pgBus';
import type {
  WeeklyActivityMutationMeta,
  WeeklyActivityRealtimeEvent,
} from '@/lib/dispensaryWeeklyActivity/realtime/types';

export async function emitWeeklyActivityChange(
  dispensaryId: string,
  event: Omit<WeeklyActivityRealtimeEvent, 'originClientId' | 'type'> & {
    type?: 'weeklyActivity';
  },
  meta?: WeeklyActivityMutationMeta,
): Promise<void> {
  await publishWeeklyActivityRealtime(dispensaryId, {
    type: 'weeklyActivity',
    activityId: event.activityId,
    ownerUserId: event.ownerUserId,
    ownerDiscordUserId: event.ownerDiscordUserId,
    periodStart: event.periodStart,
    periodEnd: event.periodEnd,
    originClientId: meta?.originClientId,
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
