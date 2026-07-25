'use server';

import { actionErrorParser } from '@/lib/action';
import type { AgendaEventDTO } from '@/types/agenda';
import {
  createAgendaEventSchema,
  updateAgendaEventSchema,
  deleteAgendaEventSchema,
  listAgendaEventsSchema,
} from '@/app/_actions/agenda/schemas';
import {
  getAgendaSessionContext,
  validateDispensaryUserIds,
} from '@/app/_actions/agenda/internals';
import {
  agendaActionError,
  agendaCookie,
  agendaScope,
} from '@/lib/agenda/client';
import type { AgendaMutationMeta } from '@/lib/agenda/realtime/mutationMeta';
import { enrichEventParticipants } from '@/lib/enrichUsers';
import type { AgendaEventRecord } from '@lawless-intranet/types';
import {
  createAgendaEvent as createAgendaEventApi,
  deleteAgendaEvent as deleteAgendaEventApi,
  getAgendaEvent as getAgendaEventApi,
  listAgendaEvents as listAgendaEventsApi,
  updateAgendaEvent as updateAgendaEventApi,
} from '@lawless-intranet/agenda-client/server';

function mapListEvent(event: AgendaEventRecord): AgendaEventDTO {
  return {
    id: event.id,
    agendaId: event.agendaId,
    title: event.title,
    description: event.description,
    startAt: new Date(event.startAt),
    endAt: new Date(event.endAt),
    allDay: event.allDay,
    createdById: event.createdById,
    participants: [],
    todoTasks: [],
    isParticipant: event.isParticipant,
    agendaName: event.agendaName,
  };
}

async function mapDetailEvent(
  event: AgendaEventRecord,
  currentUserId: string,
): Promise<AgendaEventDTO> {
  const participants = await enrichEventParticipants(event.participants);
  return {
    id: event.id,
    agendaId: event.agendaId,
    title: event.title,
    description: event.description,
    startAt: new Date(event.startAt),
    endAt: new Date(event.endAt),
    allDay: event.allDay,
    createdById: event.createdById,
    participants: participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      user: p.user ?? {
        id: p.userId,
        name: 'Utilisateur',
        email: '',
        image: null,
      },
    })),
    todoTasks: event.todoTasks.map((task) => ({
      id: task.id,
      eventId: task.eventId,
      title: task.title,
      description: task.description,
      completed: task.completed,
      completedAt: task.completedAt ? new Date(task.completedAt) : null,
      order: task.order,
    })),
    isParticipant:
      event.isParticipant ||
      participants.some((p) => p.userId === currentUserId),
    agendaName: event.agendaName,
  };
}

export async function listAgendaEvents(
  dispensarySlug: string,
  data: { agendaId?: string; rangeStart: string; rangeEnd: string },
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = listAgendaEventsSchema.parse(data);

    const events = await listAgendaEventsApi(
      {
        ...agendaScope(ctx.tenant.dispensaryId),
        agendaId: validated.agendaId,
        rangeStart: validated.rangeStart,
        rangeEnd: validated.rangeEnd,
      },
      await agendaCookie(),
    );

    return { status: 200, data: events.map(mapListEvent) };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors du chargement des événements');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement des événements');
    }
  }
}

export async function getAgendaEvent(dispensarySlug: string, eventId: string) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const event = await getAgendaEventApi(eventId, await agendaCookie());

    return {
      status: 200,
      data: await mapDetailEvent(event, ctx.session.user.id),
    };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors du chargement de l\'événement');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement de l\'événement');
    }
  }
}

export async function createAgendaEvent(
  dispensarySlug: string,
  data: {
    agendaId: string;
    title: string;
    description?: string | null;
    startDate: string;
    startTime?: string;
    endDate: string;
    endTime?: string;
    allDay: boolean;
    participantUserIds: string[];
  },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = createAgendaEventSchema.parse(data);

    const validUsers = await validateDispensaryUserIds(
      ctx.tenant.dispensaryId,
      validated.participantUserIds,
    );
    if (!validUsers) {
      return { status: 400, error: 'Un ou plusieurs participants invalides' };
    }

    const event = await createAgendaEventApi(
      {
        agendaId: validated.agendaId,
        title: validated.title,
        description: validated.description ?? null,
        startDate: validated.startDate,
        startTime: validated.startTime,
        endDate: validated.endDate,
        endTime: validated.endTime,
        allDay: validated.allDay,
        participantUserIds: validated.participantUserIds,
      },
      { ...(await agendaCookie()), meta },
    );

    return {
      status: 201,
      data: await mapDetailEvent(event, ctx.session.user.id),
    };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la création de l\'événement');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de l\'événement');
    }
  }
}

export async function updateAgendaEvent(
  dispensarySlug: string,
  data: {
    id: string;
    agendaId: string;
    title: string;
    description?: string | null;
    startDate: string;
    startTime?: string;
    endDate: string;
    endTime?: string;
    allDay: boolean;
    participantUserIds: string[];
  },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateAgendaEventSchema.parse(data);

    const validUsers = await validateDispensaryUserIds(
      ctx.tenant.dispensaryId,
      validated.participantUserIds,
    );
    if (!validUsers) {
      return { status: 400, error: 'Un ou plusieurs participants invalides' };
    }

    const event = await updateAgendaEventApi(
      validated.id,
      {
        agendaId: validated.agendaId,
        title: validated.title,
        description: validated.description ?? null,
        startDate: validated.startDate,
        startTime: validated.startTime,
        endDate: validated.endDate,
        endTime: validated.endTime,
        allDay: validated.allDay,
        participantUserIds: validated.participantUserIds,
      },
      { ...(await agendaCookie()), meta },
    );

    return {
      status: 200,
      data: await mapDetailEvent(event, ctx.session.user.id),
    };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la mise à jour de l\'événement');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la mise à jour de l\'événement');
    }
  }
}

export async function deleteAgendaEvent(
  dispensarySlug: string,
  id: string,
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = deleteAgendaEventSchema.parse({ id });

    await deleteAgendaEventApi(validated.id, {
      ...(await agendaCookie()),
      meta,
    });

    return { status: 200 };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la suppression de l\'événement');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de l\'événement');
    }
  }
}
