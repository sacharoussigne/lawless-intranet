import { createPgNotifyListener } from '@lawless-intranet/realtime/server';
import {
  broadcastWeeklyActivityRealtime,
  weeklyActivityRealtimeChannelKey,
} from '@/lib/dispensaryWeeklyActivity/realtime/hub';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';
import prisma from '@/lib/prisma';

const CHANNEL = 'weekly_activity_realtime';

type WeeklyActivityRealtimePgPayload = {
  dispensaryId: string;
  event: WeeklyActivityRealtimeEvent;
};

const listener = createPgNotifyListener<WeeklyActivityRealtimePgPayload>({
  globalKey: '__weeklyActivityRealtimePgListener',
  channel: CHANNEL,
  logLabel: 'weekly-activity-realtime',
  onPayload: (payload) => {
    broadcastWeeklyActivityRealtime(
      weeklyActivityRealtimeChannelKey(payload.dispensaryId),
      payload.event,
    );
  },
});

export async function ensureWeeklyActivityRealtimePgListener(): Promise<void> {
  await listener.ensureListener();
}

export async function publishWeeklyActivityRealtime(
  dispensaryId: string,
  event: WeeklyActivityRealtimeEvent,
): Promise<void> {
  const payload: WeeklyActivityRealtimePgPayload = { dispensaryId, event };

  await prisma.$executeRaw`SELECT pg_notify('weekly_activity_realtime', ${JSON.stringify(payload)})`;
}
