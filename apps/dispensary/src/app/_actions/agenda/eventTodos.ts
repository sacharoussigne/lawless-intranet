'use server';

import { actionErrorParser } from '@/lib/action';
import {
  createEventTodoTaskSchema,
  updateEventTodoTaskSchema,
  deleteEventTodoTaskSchema,
} from '@/app/_actions/agenda/schemas';
import { getAgendaSessionContext } from '@/app/_actions/agenda/internals';
import {
  agendaActionError,
  agendaCookie,
} from '@/lib/agenda/client';
import type { AgendaMutationMeta } from '@lawless-intranet/agenda-ui';
import type { AgendaEventTodoTaskDTO } from '@/types/agenda';
import type { AgendaEventTodoTaskRecord } from '@lawless-intranet/types';
import {
  createAgendaEventTodoTask as createAgendaEventTodoTaskApi,
  deleteAgendaEventTodoTask as deleteAgendaEventTodoTaskApi,
  listAgendaEventTodoTasks as listAgendaEventTodoTasksApi,
  updateAgendaEventTodoTask as updateAgendaEventTodoTaskApi,
} from '@lawless-intranet/agenda-client/server';

function mapEventTodoTask(task: AgendaEventTodoTaskRecord): AgendaEventTodoTaskDTO {
  return {
    id: task.id,
    eventId: task.eventId,
    title: task.title,
    description: task.description,
    completed: task.completed,
    completedAt: task.completedAt ? new Date(task.completedAt) : null,
    order: task.order,
  };
}

export async function listAgendaEventTodoTasks(
  dispensarySlug: string,
  eventId: string,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const tasks = await listAgendaEventTodoTasksApi(eventId, await agendaCookie());

    return { status: 200, data: tasks.map(mapEventTodoTask) };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors du chargement des tâches');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement des tâches');
    }
  }
}

export async function createAgendaEventTodoTask(
  dispensarySlug: string,
  data: { eventId: string; title: string; description?: string | null },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = createEventTodoTaskSchema.parse(data);

    const task = await createAgendaEventTodoTaskApi(
      validated.eventId,
      {
        title: validated.title,
        description: validated.description ?? null,
      },
      { ...(await agendaCookie()), meta },
    );

    return { status: 201, data: mapEventTodoTask(task) };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la création de la tâche');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la tâche');
    }
  }
}

export async function updateAgendaEventTodoTask(
  dispensarySlug: string,
  data: {
    id: string;
    title?: string;
    description?: string | null;
    completed?: boolean;
  },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateEventTodoTaskSchema.parse(data);

    const task = await updateAgendaEventTodoTaskApi(
      validated.id,
      {
        title: validated.title,
        description: validated.description,
        completed: validated.completed,
      },
      { ...(await agendaCookie()), meta },
    );

    return { status: 200, data: mapEventTodoTask(task) };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la mise à jour de la tâche');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la mise à jour de la tâche');
    }
  }
}

export async function deleteAgendaEventTodoTask(
  dispensarySlug: string,
  id: string,
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = deleteEventTodoTaskSchema.parse({ id });

    await deleteAgendaEventTodoTaskApi(validated.id, {
      ...(await agendaCookie()),
      meta,
    });

    return { status: 200 };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la suppression de la tâche');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la tâche');
    }
  }
}
