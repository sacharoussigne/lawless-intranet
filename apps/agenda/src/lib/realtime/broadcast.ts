import { after } from 'next/server';
import { realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime, revokeRealtimeTopics } from '@lawless-intranet/realtime/publish';
import prisma from '@/lib/prisma';
import { toAgendaRealtimeEnvelope } from '@/lib/realtime/envelope';
import type { AgendaMutationMeta, AgendaRealtimeEvent } from '@/lib/realtime/types';

/**
 * Publishes agenda changes to the realtime websocket server.
 * Called after the write is committed. Publishing runs after the response is
 * sent (`after`), so the request never waits for the realtime server; never throws.
 *
 * Topics:
 * - agenda:<agendaId> — members of the agenda
 * - user:<userId>     — event participants who may not be members, access changes
 * - agendas:<scope>   — agenda list of the scope
 */
const LOG_LABEL = 'agenda-realtime';

async function publish(
  topics: string[],
  event: Omit<AgendaRealtimeEvent, 'originClientId'>,
  meta?: AgendaMutationMeta,
): Promise<void> {
  await publishRealtime(
    topics,
    toAgendaRealtimeEnvelope({ ...event, originClientId: meta?.originClientId }),
    { logLabel: LOG_LABEL },
  );
}

export async function listEventParticipantIds(eventId: string): Promise<string[]> {
  const participants = await prisma.agendaEventParticipant.findMany({
    where: { eventId },
    select: { userId: true },
  });
  return participants.map((participant) => participant.userId);
}

function participantTopics(participantUserIds: Iterable<string> = []): string[] {
  return [...new Set(participantUserIds)].map(realtimeTopics.user);
}

export function emitAgendaEventsChange(
  _scopeType: string,
  _scopeId: string,
  agendaId: string,
  meta?: AgendaMutationMeta,
  options: { eventId?: string; participantUserIds?: Iterable<string> } = {},
): void {
  const topics = [realtimeTopics.agenda(agendaId), ...participantTopics(options.participantUserIds)];
  after(() => publish(topics, { type: 'events', agendaId, eventId: options.eventId }, meta));
}

export function emitAgendaTodosChange(
  _scopeType: string,
  _scopeId: string,
  agendaId: string,
  meta?: AgendaMutationMeta,
): void {
  after(() => publish([realtimeTopics.agenda(agendaId)], { type: 'todos', agendaId }, meta));
}

export function emitAgendaEventTodosChange(
  _scopeType: string,
  _scopeId: string,
  agendaId: string,
  eventId: string,
  meta?: AgendaMutationMeta,
): void {
  after(async () => {
    let participantUserIds: string[] = [];
    try {
      participantUserIds = await listEventParticipantIds(eventId);
    } catch (error) {
      console.error(`[${LOG_LABEL}] failed to load event participants`, error);
    }
    await publish(
      [realtimeTopics.agenda(agendaId), ...participantTopics(participantUserIds)],
      { type: 'eventTodos', agendaId, eventId },
      meta,
    );
  });
}

/** Agenda created, renamed or deleted: refresh the agenda list of the scope. */
export function emitAgendaListChange(scopeType: string, scopeId: string, agendaId?: string): void {
  after(() => publishAgendaListChange(scopeType, scopeId, agendaId));
}

async function publishAgendaListChange(
  scopeType: string,
  scopeId: string,
  agendaId?: string,
): Promise<void> {
  await publish([realtimeTopics.agendas(scopeType, scopeId)], { type: 'agendas', agendaId });
}

/**
 * Agenda access of users changed. Revoked users lose the agenda topic on their
 * live connections; every affected user is told to refresh its realtime token.
 */
export function emitAgendaAccessChange(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  changes: { grantedUserIds?: string[]; revokedUserIds?: string[] },
): void {
  const revokedUserIds = changes.revokedUserIds ?? [];
  const affectedUserIds = [...new Set([...(changes.grantedUserIds ?? []), ...revokedUserIds])];

  after(async () => {
    await Promise.all(
      revokedUserIds.map((userId) =>
        revokeRealtimeTopics(userId, [realtimeTopics.agenda(agendaId)], { logLabel: LOG_LABEL }),
      ),
    );
    await Promise.all([
      publish(participantTopics(affectedUserIds), { type: 'access', agendaId }),
      publishAgendaListChange(scopeType, scopeId, agendaId),
    ]);
  });
}
