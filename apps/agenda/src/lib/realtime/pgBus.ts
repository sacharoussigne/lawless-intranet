import { createPgNotifyListener } from '@lawless-intranet/realtime/server';
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

const listener = createPgNotifyListener<AgendaRealtimePgPayload>({
  globalKey: '__agendaRealtimePgListener',
  channel: CHANNEL,
  logLabel: 'agenda-realtime',
  onPayload: (payload) => {
    broadcastAgendaRealtime(scopeKey(payload.scopeType, payload.scopeId), payload.event);
  },
});

export async function ensureAgendaRealtimePgListener(): Promise<void> {
  await listener.ensureListener();
}

export async function publishAgendaRealtime(
  scopeType: string,
  scopeId: string,
  event: AgendaRealtimeEvent,
): Promise<void> {
  const payload: AgendaRealtimePgPayload = { scopeType, scopeId, event };

  await prisma.$executeRaw`SELECT pg_notify('agenda_realtime', ${JSON.stringify(payload)})`;
}
