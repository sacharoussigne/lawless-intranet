import { Client } from 'pg';
import {
  broadcastWeeklySalesRealtime,
  weeklySalesRealtimeChannelKey,
} from '@/lib/sales/realtime/hub';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';
import prisma from '@/lib/prisma';

const CHANNEL = 'sales_realtime';

type WeeklySalesRealtimePgPayload = {
  dispensaryId: string;
  event: WeeklySalesRealtimeEvent;
};

type WeeklySalesRealtimePgGlobal = typeof globalThis & {
  __weeklySalesRealtimePgListener?: Promise<void>;
};

export async function ensureWeeklySalesRealtimePgListener(): Promise<void> {
  const globalStore = globalThis as WeeklySalesRealtimePgGlobal;
  if (globalStore.__weeklySalesRealtimePgListener) {
    return globalStore.__weeklySalesRealtimePgListener;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return;
  }

  globalStore.__weeklySalesRealtimePgListener = (async () => {
    const client = new Client({ connectionString });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);

    client.on('notification', (message) => {
      if (!message.payload) return;

      try {
        const payload = JSON.parse(message.payload) as WeeklySalesRealtimePgPayload;
        broadcastWeeklySalesRealtime(
          weeklySalesRealtimeChannelKey(payload.dispensaryId),
          payload.event,
        );
      } catch {
        // Ignore malformed payloads.
      }
    });

    client.on('error', (error) => {
      console.error('[sales-realtime] PostgreSQL listener error', error);
      globalStore.__weeklySalesRealtimePgListener = undefined;
    });
  })();

  return globalStore.__weeklySalesRealtimePgListener;
}

export async function publishWeeklySalesRealtime(
  dispensaryId: string,
  event: WeeklySalesRealtimeEvent,
): Promise<void> {
  const payload: WeeklySalesRealtimePgPayload = { dispensaryId, event };

  await prisma.$executeRaw`SELECT pg_notify('sales_realtime', ${JSON.stringify(payload)})`;
}
