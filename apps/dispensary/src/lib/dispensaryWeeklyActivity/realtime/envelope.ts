import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';

export type WeeklyActivityRealtimePayload = Omit<
  WeeklyActivityRealtimeEvent,
  'type' | 'originClientId'
>;

export function toWeeklyActivityRealtimeEnvelope(
  event: WeeklyActivityRealtimeEvent,
): RealtimeEnvelope<WeeklyActivityRealtimePayload> {
  return {
    domain: REALTIME_DOMAIN.weeklyActivity,
    type: event.type,
    originClientId: event.originClientId,
    payload: {
      activityId: event.activityId,
      ownerUserId: event.ownerUserId,
      ownerDiscordUserId: event.ownerDiscordUserId,
      periodStart: event.periodStart,
      periodEnd: event.periodEnd,
    },
  };
}

export function fromWeeklyActivityRealtimeEnvelope(
  envelope: RealtimeEnvelope,
): WeeklyActivityRealtimeEvent {
  const payload = envelope.payload as WeeklyActivityRealtimePayload;
  return {
    type: 'weeklyActivity',
    activityId: payload.activityId,
    ownerUserId: payload.ownerUserId,
    ownerDiscordUserId: payload.ownerDiscordUserId,
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    originClientId: envelope.originClientId,
  };
}
