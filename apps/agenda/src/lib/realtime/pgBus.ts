import { Client } from 'pg';
import { broadcastAgendaRealtime } from '@/lib/realtime/hub';
import type { AgendaRealtimeEvent } from '@/lib/realtime/types';
import { scopeKey } from '@/lib/scope';
import prisma from '@/lib/prisma';

const CHANNEL = 'agenda_realtime';

type AgendaRealtimePgPayload = {
  scopeType: string;
  scopeId: string;
  event: AgendaRealtimeEvent;
};

type AgendaRealtimePgGlobal = typeof globalThis & {
  __agendaRealtimePgListener?: Promise<void>;
};

export async function ensureAgendaRealtimePgListener(): Promise<void> {
  const globalStore = globalThis as AgendaRealtimePgGlobal;
  if (globalStore.__agendaRealtimePgListener) {
    return globalStore.__agendaRealtimePgListener;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return;
  }

  globalStore.__agendaRealtimePgListener = (async () => {
    const client = new Client({ connectionString });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);

    client.on('notification', (message) => {
      if (!message.payload) return;

      try {
        const payload = JSON.parse(message.payload) as AgendaRealtimePgPayload;
        broadcastAgendaRealtime(
          scopeKey(payload.scopeType, payload.scopeId),
          payload.event,
        );
      } catch {
        // Ignore malformed payloads.
      }
    });

    client.on('error', (error) => {
      console.error('[agenda-realtime] PostgreSQL listener error', error);
      globalStore.__agendaRealtimePgListener = undefined;
    });
  })();

  return globalStore.__agendaRealtimePgListener;
}

export async function publishAgendaRealtime(
  scopeType: string,
  scopeId: string,
  event: AgendaRealtimeEvent,
): Promise<void> {
  const payload: AgendaRealtimePgPayload = { scopeType, scopeId, event };

  await prisma.$executeRaw`SELECT pg_notify('agenda_realtime', ${JSON.stringify(payload)})`;
}
