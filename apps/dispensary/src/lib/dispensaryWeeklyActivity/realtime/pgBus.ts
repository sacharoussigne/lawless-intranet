import { Client } from 'pg';
import { broadcastWeeklyActivityRealtime, weeklyActivityRealtimeChannelKey } from '@/lib/dispensaryWeeklyActivity/realtime/hub';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';
import prisma from '@/lib/prisma';

const CHANNEL = 'weekly_activity_realtime';

type WeeklyActivityRealtimePgPayload = {
  dispensaryId: string;
  event: WeeklyActivityRealtimeEvent;
};

type WeeklyActivityRealtimePgGlobal = typeof globalThis & {
  __weeklyActivityRealtimePgListener?: Promise<void>;
};

export async function ensureWeeklyActivityRealtimePgListener(): Promise<void> {
  const globalStore = globalThis as WeeklyActivityRealtimePgGlobal;
  if (globalStore.__weeklyActivityRealtimePgListener) {
    return globalStore.__weeklyActivityRealtimePgListener;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return;
  }

  globalStore.__weeklyActivityRealtimePgListener = (async () => {
    const client = new Client({ connectionString });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);

    client.on('notification', (message) => {
      if (!message.payload) return;

      try {
        const payload = JSON.parse(message.payload) as WeeklyActivityRealtimePgPayload;
        broadcastWeeklyActivityRealtime(
          weeklyActivityRealtimeChannelKey(payload.dispensaryId),
          payload.event,
        );
      } catch {
        // Ignore malformed payloads.
      }
    });

    client.on('error', (error) => {
      console.error('[weekly-activity-realtime] PostgreSQL listener error', error);
      globalStore.__weeklyActivityRealtimePgListener = undefined;
    });
  })();

  return globalStore.__weeklyActivityRealtimePgListener;
}

export async function publishWeeklyActivityRealtime(
  dispensaryId: string,
  event: WeeklyActivityRealtimeEvent,
): Promise<void> {
  const payload: WeeklyActivityRealtimePgPayload = { dispensaryId, event };

  await prisma.$executeRaw`SELECT pg_notify('weekly_activity_realtime', ${JSON.stringify(payload)})`;
}
