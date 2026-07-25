'use server';

import { actionErrorParser } from '@/lib/action';
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
  agendaActionError,
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
    try {
      return agendaActionError(error, 'Erreur lors du chargement des listes');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement des listes');
    }
  }
}

export async function createAgendaTodoList(
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
    try {
      return agendaActionError(error, 'Erreur lors de la création de la liste');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la liste');
    }
  }
}

export async function updateAgendaTodoList(
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
    try {
      return agendaActionError(error, 'Erreur lors de la mise à jour de la liste');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la mise à jour de la liste');
    }
  }
}

export async function deleteAgendaTodoList(
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
    try {
      return agendaActionError(error, 'Erreur lors de la suppression de la liste');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la liste');
    }
  }
}

export async function createAgendaTodoCategory(
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
    try {
      return agendaActionError(error, 'Erreur lors de la création de la catégorie');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la catégorie');
    }
  }
}

export async function updateAgendaTodoCategory(
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
    try {
      return agendaActionError(error, 'Erreur lors de la mise à jour de la catégorie');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la mise à jour de la catégorie');
    }
  }
}

export async function deleteAgendaTodoCategory(
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
    try {
      return agendaActionError(error, 'Erreur lors de la suppression de la catégorie');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la catégorie');
    }
  }
}

export async function createAgendaTodoTask(
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
    try {
      return agendaActionError(error, 'Erreur lors de la création de la tâche');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la tâche');
    }
  }
}

export async function updateAgendaTodoTask(
  dispensarySlug: string,
  data: {
    id: string;
    title?: string;
    description?: string | null;
    completed?: boolean;
    categoryId?: string;
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
      },
      { ...(await agendaCookie()), meta },
    );

    return { status: 200, data: mapTodoTask(task) };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la mise à jour de la tâche');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la mise à jour de la tâche');
    }
  }
}

export async function deleteAgendaTodoTask(
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
    try {
      return agendaActionError(error, 'Erreur lors de la suppression de la tâche');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la tâche');
    }
  }
}

export async function reorderAgendaTodoCategories(
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
    try {
      return agendaActionError(error, 'Erreur lors du réordonnancement');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du réordonnancement');
    }
  }
}

export async function moveAgendaTodoTask(
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
    try {
      return agendaActionError(error, 'Erreur lors du déplacement de la tâche');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du déplacement de la tâche');
    }
  }
}
