'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import {
  createEventTodoTaskSchema,
  updateEventTodoTaskSchema,
  deleteEventTodoTaskSchema,
} from '@/app/_actions/agenda/schemas';
import { getAgendaSessionContext } from '@/app/_actions/agenda/internals';
import {
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
  businessSlug: string,
  eventId: string,
) {
  try {
    const ctx = await getAgendaSessionContext(businessSlug);
    if (!ctx.ok) return ctx.response;

    const tasks = await listAgendaEventTodoTasksApi(eventId, await agendaCookie());

    return { status: 200, data: tasks.map(mapEventTodoTask) };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du chargement des tâches');
  }
}

async function createAgendaEventTodoTaskUnlogged(
  businessSlug: string,
  data: { eventId: string; title: string; description?: string | null },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(businessSlug);
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
    return serviceActionError(error, 'Erreur lors de la création de la tâche');
  }
}

async function updateAgendaEventTodoTaskUnlogged(
  businessSlug: string,
  data: {
    id: string;
    title?: string;
    description?: string | null;
    completed?: boolean;
  },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(businessSlug);
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
    return serviceActionError(error, 'Erreur lors de la mise à jour de la tâche');
  }
}

async function deleteAgendaEventTodoTaskUnlogged(
  businessSlug: string,
  id: string,
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(businessSlug);
    if (!ctx.ok) return ctx.response;

    const validated = deleteEventTodoTaskSchema.parse({ id });

    await deleteAgendaEventTodoTaskApi(validated.id, {
      ...(await agendaCookie()),
      meta,
    });

    return { status: 200 };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression de la tâche');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createAgendaEventTodoTask(
  ...args: Parameters<typeof createAgendaEventTodoTaskUnlogged>
) {
  return loggedAction(
    { feature: 'agenda', event: 'eventTodos.createAgendaEventTodoTask' },
    args,
    () => createAgendaEventTodoTaskUnlogged(...args),
  );
}

export async function updateAgendaEventTodoTask(
  ...args: Parameters<typeof updateAgendaEventTodoTaskUnlogged>
) {
  return loggedAction(
    { feature: 'agenda', event: 'eventTodos.updateAgendaEventTodoTask' },
    args,
    () => updateAgendaEventTodoTaskUnlogged(...args),
  );
}

export async function deleteAgendaEventTodoTask(
  ...args: Parameters<typeof deleteAgendaEventTodoTaskUnlogged>
) {
  return loggedAction(
    { feature: 'agenda', event: 'eventTodos.deleteAgendaEventTodoTask' },
    args,
    () => deleteAgendaEventTodoTaskUnlogged(...args),
  );
}
