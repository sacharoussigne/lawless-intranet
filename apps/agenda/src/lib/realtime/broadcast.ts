import { realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime, revokeRealtimeTopics } from '@lawless-intranet/realtime/publish';
import prisma from '@/lib/prisma';
import { toAgendaRealtimeEnvelope } from '@/lib/realtime/envelope';
import type { AgendaMutationMeta, AgendaRealtimeEvent } from '@/lib/realtime/types';

/**
 * Publishes agenda changes to the realtime websocket server.
 * Called after the write is committed; never throws (see publishRealtime).
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

export async function emitAgendaEventsChange(
  _scopeType: string,
  _scopeId: string,
  agendaId: string,
  meta?: AgendaMutationMeta,
  options: { eventId?: string; participantUserIds?: Iterable<string> } = {},
): Promise<void> {
  await publish(
    [realtimeTopics.agenda(agendaId), ...participantTopics(options.participantUserIds)],
    { type: 'events', agendaId, eventId: options.eventId },
    meta,
  );
}

export async function emitAgendaTodosChange(
  _scopeType: string,
  _scopeId: string,
  agendaId: string,
  meta?: AgendaMutationMeta,
): Promise<void> {
  await publish([realtimeTopics.agenda(agendaId)], { type: 'todos', agendaId }, meta);
}

export async function emitAgendaEventTodosChange(
  _scopeType: string,
  _scopeId: string,
  agendaId: string,
  eventId: string,
  meta?: AgendaMutationMeta,
): Promise<void> {
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
}

/** Agenda created, renamed or deleted: refresh the agenda list of the scope. */
export async function emitAgendaListChange(
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
export async function emitAgendaAccessChange(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  changes: { grantedUserIds?: string[]; revokedUserIds?: string[] },
): Promise<void> {
  const revokedUserIds = changes.revokedUserIds ?? [];
  const affectedUserIds = [...new Set([...(changes.grantedUserIds ?? []), ...revokedUserIds])];

  await Promise.all(
    revokedUserIds.map((userId) =>
      revokeRealtimeTopics(userId, [realtimeTopics.agenda(agendaId)], { logLabel: LOG_LABEL }),
    ),
  );
  await publish(participantTopics(affectedUserIds), { type: 'access', agendaId });
  await emitAgendaListChange(scopeType, scopeId, agendaId);
}
