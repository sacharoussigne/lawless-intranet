'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import type { AgendaTodoListDTO } from '@/types/agenda';
import {
  createTodoListSchema,
  updateTodoListSchema,
  deleteTodoListSchema,
  createTodoCategorySchema,
  updateTodoCategorySchema,
  deleteTodoCategorySchema,
  createTodoTaskSchema,
  updateTodoTaskSchema,
  deleteTodoTaskSchema,
  moveTodoTaskSchema,
  reorderSchema,
} from '@/app/_actions/agenda/schemas';
import { getAgendaSessionContext } from '@/app/_actions/agenda/internals';
import {
  agendaCookie,
} from '@/lib/agenda/client';
import type { AgendaMutationMeta } from '@lawless-intranet/agenda-ui';
import type {
  AgendaTodoCategoryRecord,
  AgendaTodoListRecord,
  AgendaTodoTaskRecord,
} from '@lawless-intranet/types';
import {
  createAgendaTodoCategory as createAgendaTodoCategoryApi,
  createAgendaTodoList as createAgendaTodoListApi,
  createAgendaTodoTask as createAgendaTodoTaskApi,
  deleteAgendaTodoCategory as deleteAgendaTodoCategoryApi,
  deleteAgendaTodoList as deleteAgendaTodoListApi,
  deleteAgendaTodoTask as deleteAgendaTodoTaskApi,
  listAgendaTodoLists as listAgendaTodoListsApi,
  moveAgendaTodoTask as moveAgendaTodoTaskApi,
  reorderAgendaTodoCategories as reorderAgendaTodoCategoriesApi,
  updateAgendaTodoCategory as updateAgendaTodoCategoryApi,
  updateAgendaTodoList as updateAgendaTodoListApi,
  updateAgendaTodoTask as updateAgendaTodoTaskApi,
} from '@lawless-intranet/agenda-client/server';

function mapTodoTask(task: AgendaTodoTaskRecord) {
  return {
    id: task.id,
    categoryId: task.categoryId,
    title: task.title,
    description: task.description,
    completed: task.completed,
    completedAt: task.completedAt ? new Date(task.completedAt) : null,
    order: task.order,
    updatedAt: task.updatedAt ? new Date(task.updatedAt) : null,
  };
}

function mapTodoCategory(category: AgendaTodoCategoryRecord) {
  return {
    id: category.id,
    listId: category.listId,
    name: category.name,
    order: category.order,
    tasks: category.tasks.map(mapTodoTask),
  };
}

function mapTodoList(list: AgendaTodoListRecord): AgendaTodoListDTO {
  return {
    id: list.id,
    agendaId: list.agendaId,
    name: list.name,
    order: list.order,
    categories: list.categories.map(mapTodoCategory),
  };
}

export async function listAgendaTodoLists(
  dispensarySlug: string,
  agendaId: string,
  options?: { archives?: boolean },
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const lists = await listAgendaTodoListsApi(agendaId, {
      ...(await agendaCookie()),
      archives: options?.archives,
    });

    return { status: 200, data: lists.map(mapTodoList) };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du chargement des listes');
  }
}

async function createAgendaTodoListUnlogged(
  dispensarySlug: string,
  data: { agendaId: string; name: string },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = createTodoListSchema.parse(data);

    const list = await createAgendaTodoListApi(
      validated.agendaId,
      { name: validated.name },
      { ...(await agendaCookie()), meta },
    );

    return { status: 201, data: mapTodoList(list) };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la création de la liste');
  }
}

async function updateAgendaTodoListUnlogged(
  dispensarySlug: string,
  data: { id: string; name: string },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateTodoListSchema.parse(data);

    const list = await updateAgendaTodoListApi(
      validated.id,
      { name: validated.name },
      { ...(await agendaCookie()), meta },
    );

    return { status: 200, data: mapTodoList(list) };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la mise à jour de la liste');
  }
}

async function deleteAgendaTodoListUnlogged(
  dispensarySlug: string,
  id: string,
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = deleteTodoListSchema.parse({ id });

    await deleteAgendaTodoListApi(validated.id, {
      ...(await agendaCookie()),
      meta,
    });

    return { status: 200 };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression de la liste');
  }
}

async function createAgendaTodoCategoryUnlogged(
  dispensarySlug: string,
  data: { listId: string; name: string },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = createTodoCategorySchema.parse(data);

    const category = await createAgendaTodoCategoryApi(
      validated.listId,
      { name: validated.name },
      { ...(await agendaCookie()), meta },
    );

    return { status: 201, data: mapTodoCategory(category) };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la création de la catégorie');
  }
}

async function updateAgendaTodoCategoryUnlogged(
  dispensarySlug: string,
  data: { id: string; name: string },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateTodoCategorySchema.parse(data);

    const category = await updateAgendaTodoCategoryApi(
      validated.id,
      { name: validated.name },
      { ...(await agendaCookie()), meta },
    );

    return { status: 200, data: mapTodoCategory(category) };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la mise à jour de la catégorie');
  }
}

async function deleteAgendaTodoCategoryUnlogged(
  dispensarySlug: string,
  id: string,
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = deleteTodoCategorySchema.parse({ id });

    await deleteAgendaTodoCategoryApi(validated.id, {
      ...(await agendaCookie()),
      meta,
    });

    return { status: 200 };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression de la catégorie');
  }
}

async function createAgendaTodoTaskUnlogged(
  dispensarySlug: string,
  data: { categoryId: string; title: string; description?: string | null },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = createTodoTaskSchema.parse(data);

    const task = await createAgendaTodoTaskApi(
      validated.categoryId,
      {
        title: validated.title,
        description: validated.description ?? null,
      },
      { ...(await agendaCookie()), meta },
    );

    return { status: 201, data: mapTodoTask(task) };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la création de la tâche');
  }
}

async function updateAgendaTodoTaskUnlogged(
  dispensarySlug: string,
  data: {
    id: string;
    title?: string;
    description?: string | null;
    completed?: boolean;
    categoryId?: string;
    expectedUpdatedAt?: string;
  },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateTodoTaskSchema.parse(data);

    const task = await updateAgendaTodoTaskApi(
      validated.id,
      {
        title: validated.title,
        description: validated.description,
        completed: validated.completed,
        categoryId: validated.categoryId,
        expectedUpdatedAt: validated.expectedUpdatedAt,
      },
      { ...(await agendaCookie()), meta },
    );

    return { status: 200, data: mapTodoTask(task) };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la mise à jour de la tâche');
  }
}

async function deleteAgendaTodoTaskUnlogged(
  dispensarySlug: string,
  id: string,
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = deleteTodoTaskSchema.parse({ id });

    await deleteAgendaTodoTaskApi(validated.id, {
      ...(await agendaCookie()),
      meta,
    });

    return { status: 200 };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression de la tâche');
  }
}

async function reorderAgendaTodoCategoriesUnlogged(
  dispensarySlug: string,
  data: { items: { id: string; order: number }[] },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = reorderSchema.parse(data);
    if (validated.items.length === 0) {
      return { status: 200, data: { success: true as const } };
    }

    const result = await reorderAgendaTodoCategoriesApi(validated.items, {
      ...(await agendaCookie()),
      meta,
    });

    return { status: 200, data: result };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du réordonnancement');
  }
}

async function moveAgendaTodoTaskUnlogged(
  dispensarySlug: string,
  data: {
    taskId: string;
    sourceCategoryId: string;
    targetCategoryId: string;
    sourceOrders: { id: string; order: number }[];
    targetOrders: { id: string; order: number }[];
  },
  meta?: AgendaMutationMeta,
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = moveTodoTaskSchema.parse(data);

    const result = await moveAgendaTodoTaskApi(validated, {
      ...(await agendaCookie()),
      meta,
    });

    return { status: 200, data: result };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du déplacement de la tâche');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createAgendaTodoList(
  ...args: Parameters<typeof createAgendaTodoListUnlogged>
) {
  return loggedAction({ feature: 'agenda', event: 'todoLists.createAgendaTodoList' }, args, () =>
    createAgendaTodoListUnlogged(...args),
  );
}

export async function updateAgendaTodoList(
  ...args: Parameters<typeof updateAgendaTodoListUnlogged>
) {
  return loggedAction({ feature: 'agenda', event: 'todoLists.updateAgendaTodoList' }, args, () =>
    updateAgendaTodoListUnlogged(...args),
  );
}

export async function deleteAgendaTodoList(
  ...args: Parameters<typeof deleteAgendaTodoListUnlogged>
) {
  return loggedAction({ feature: 'agenda', event: 'todoLists.deleteAgendaTodoList' }, args, () =>
    deleteAgendaTodoListUnlogged(...args),
  );
}

export async function createAgendaTodoCategory(
  ...args: Parameters<typeof createAgendaTodoCategoryUnlogged>
) {
  return loggedAction(
    { feature: 'agenda', event: 'todoLists.createAgendaTodoCategory' },
    args,
    () => createAgendaTodoCategoryUnlogged(...args),
  );
}

export async function updateAgendaTodoCategory(
  ...args: Parameters<typeof updateAgendaTodoCategoryUnlogged>
) {
  return loggedAction(
    { feature: 'agenda', event: 'todoLists.updateAgendaTodoCategory' },
    args,
    () => updateAgendaTodoCategoryUnlogged(...args),
  );
}

export async function deleteAgendaTodoCategory(
  ...args: Parameters<typeof deleteAgendaTodoCategoryUnlogged>
) {
  return loggedAction(
    { feature: 'agenda', event: 'todoLists.deleteAgendaTodoCategory' },
    args,
    () => deleteAgendaTodoCategoryUnlogged(...args),
  );
}

export async function createAgendaTodoTask(
  ...args: Parameters<typeof createAgendaTodoTaskUnlogged>
) {
  return loggedAction({ feature: 'agenda', event: 'todoLists.createAgendaTodoTask' }, args, () =>
    createAgendaTodoTaskUnlogged(...args),
  );
}

export async function updateAgendaTodoTask(
  ...args: Parameters<typeof updateAgendaTodoTaskUnlogged>
) {
  return loggedAction({ feature: 'agenda', event: 'todoLists.updateAgendaTodoTask' }, args, () =>
    updateAgendaTodoTaskUnlogged(...args),
  );
}

export async function deleteAgendaTodoTask(
  ...args: Parameters<typeof deleteAgendaTodoTaskUnlogged>
) {
  return loggedAction({ feature: 'agenda', event: 'todoLists.deleteAgendaTodoTask' }, args, () =>
    deleteAgendaTodoTaskUnlogged(...args),
  );
}

export async function reorderAgendaTodoCategories(
  ...args: Parameters<typeof reorderAgendaTodoCategoriesUnlogged>
) {
  return loggedAction(
    { feature: 'agenda', event: 'todoLists.reorderAgendaTodoCategories' },
    args,
    () => reorderAgendaTodoCategoriesUnlogged(...args),
  );
}

export async function moveAgendaTodoTask(...args: Parameters<typeof moveAgendaTodoTaskUnlogged>) {
  return loggedAction(
    {
      feature: 'agenda',
      event: 'todoLists.moveAgendaTodoTask',
      target: ([, data]) => data.taskId,
    },
    args,
    () => moveAgendaTodoTaskUnlogged(...args),
  );
}
