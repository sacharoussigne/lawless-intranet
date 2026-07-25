import type {
  AgendaAccessLevel,
  AgendaAccessRecord,
  AgendaBootstrapRecord,
  AgendaEventRecord,
  AgendaEventTodoTaskRecord,
  AgendaMemberRecord,
  AgendaMutationMeta,
  AgendaRecord,
  AgendaScopeParams,
  AgendaSummaryRecord,
  AgendaTodoCategoryRecord,
  AgendaTodoListRecord,
  AgendaTodoTaskRecord,
} from '@lawless-intranet/types';
import {
  agendaFetch,
  getAgendaUrl,
  parseJsonResponse,
  toQuery,
  type AgendaFetchOptions,
} from './config';

type ClientOptions = Pick<AgendaFetchOptions, 'cookieHeader'>;

type ScopeAdminOptions = ClientOptions & {
  scopeAdmin?: boolean;
};

type MetaOptions = ClientOptions & {
  meta?: AgendaMutationMeta;
};

function withScopeAdmin(scopeAdmin?: boolean): string | undefined {
  return scopeAdmin ? 'true' : undefined;
}

export async function getAgendaAccess(
  params: AgendaScopeParams,
  options: ClientOptions = {},
): Promise<AgendaAccessRecord> {
  const response = await agendaFetch(
    `/api/access${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function listAccessibleAgendas(
  params: AgendaScopeParams,
  options: ClientOptions = {},
): Promise<AgendaSummaryRecord[]> {
  const response = await agendaFetch(
    `/api/agendas${toQuery({ ...params, mode: 'accessible' })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function listAllAgendas(
  params: AgendaScopeParams,
  options: ClientOptions = {},
): Promise<AgendaRecord[]> {
  const response = await agendaFetch(
    `/api/agendas${toQuery({
      ...params,
      mode: 'all',
      scopeAdmin: 'true',
    })}`,
    { cookieHeader: options.cookieHeader, scopeAdmin: true },
  );
  return parseJsonResponse(response);
}

export async function getAgendaBootstrap(
  params: AgendaScopeParams,
  options: ClientOptions = {},
): Promise<AgendaBootstrapRecord> {
  const response = await agendaFetch(
    `/api/agendas${toQuery({ ...params, mode: 'bootstrap' })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createAgenda(
  input: AgendaScopeParams & {
    name: string;
    description?: string | null;
    ownerUserId: string;
  },
  options: MetaOptions = {},
): Promise<AgendaRecord> {
  const response = await agendaFetch('/api/agendas', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    scopeAdmin: true,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function getAgenda(
  agendaId: string,
  params: AgendaScopeParams,
  options: ScopeAdminOptions = {},
): Promise<AgendaRecord> {
  const response = await agendaFetch(
    `/api/agendas/${agendaId}${toQuery({
      ...params,
      scopeAdmin: withScopeAdmin(options.scopeAdmin),
    })}`,
    {
      cookieHeader: options.cookieHeader,
      scopeAdmin: options.scopeAdmin === true,
    },
  );
  return parseJsonResponse(response);
}

export async function updateAgenda(
  agendaId: string,
  input: {
    name: string;
    description?: string | null;
    scopeAdmin?: boolean;
  },
  options: MetaOptions = {},
): Promise<AgendaRecord> {
  const response = await agendaFetch(`/api/agendas/${agendaId}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    scopeAdmin: input.scopeAdmin === true,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function deleteAgenda(
  agendaId: string,
  input: { scopeAdmin?: boolean } = {},
  options: MetaOptions = {},
): Promise<void> {
  const response = await agendaFetch(`/api/agendas/${agendaId}`, {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    scopeAdmin: input.scopeAdmin === true,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  await parseJsonResponse(response);
}

export async function upsertAgendaMember(
  agendaId: string,
  input: {
    userId: string;
    accessLevel: AgendaAccessLevel;
    scopeAdmin?: boolean;
  },
  options: MetaOptions = {},
): Promise<AgendaMemberRecord> {
  const response = await agendaFetch(`/api/agendas/${agendaId}/members`, {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    scopeAdmin: input.scopeAdmin === true,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function removeAgendaMember(
  agendaId: string,
  userId: string,
  input: { scopeAdmin?: boolean } = {},
  options: MetaOptions = {},
): Promise<void> {
  const response = await agendaFetch(
    `/api/agendas/${agendaId}/members/${encodeURIComponent(userId)}${toQuery({
      scopeAdmin: withScopeAdmin(input.scopeAdmin),
    })}`,
    {
      method: 'DELETE',
      cookieHeader: options.cookieHeader,
      scopeAdmin: input.scopeAdmin === true,
      body: JSON.stringify({ ...input, meta: options.meta }),
    },
  );
  await parseJsonResponse(response);
}

export async function listAgendaEvents(
  params: AgendaScopeParams & {
    agendaId?: string;
    rangeStart: string;
    rangeEnd: string;
  },
  options: ClientOptions = {},
): Promise<AgendaEventRecord[]> {
  const response = await agendaFetch(
    `/api/events${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function getAgendaEvent(
  eventId: string,
  options: ClientOptions = {},
): Promise<AgendaEventRecord> {
  const response = await agendaFetch(`/api/events/${eventId}`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export type CreateAgendaEventInput = {
  agendaId: string;
  title: string;
  description?: string | null;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  allDay: boolean;
  participantUserIds: string[];
};

export async function createAgendaEvent(
  input: CreateAgendaEventInput,
  options: MetaOptions = {},
): Promise<AgendaEventRecord> {
  const response = await agendaFetch('/api/events', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function updateAgendaEvent(
  eventId: string,
  input: CreateAgendaEventInput & { agendaId: string },
  options: MetaOptions = {},
): Promise<AgendaEventRecord> {
  const response = await agendaFetch(`/api/events/${eventId}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function deleteAgendaEvent(
  eventId: string,
  options: MetaOptions = {},
): Promise<void> {
  const response = await agendaFetch(`/api/events/${eventId}`, {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ meta: options.meta }),
  });
  await parseJsonResponse(response);
}

export async function listAgendaEventTodoTasks(
  eventId: string,
  options: ClientOptions = {},
): Promise<AgendaEventTodoTaskRecord[]> {
  const response = await agendaFetch(`/api/events/${eventId}/todos`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export async function createAgendaEventTodoTask(
  eventId: string,
  input: { title: string; description?: string | null },
  options: MetaOptions = {},
): Promise<AgendaEventTodoTaskRecord> {
  const response = await agendaFetch(`/api/events/${eventId}/todos`, {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function updateAgendaEventTodoTask(
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    completed?: boolean;
  },
  options: MetaOptions = {},
): Promise<AgendaEventTodoTaskRecord> {
  const response = await agendaFetch(`/api/event-todos/${taskId}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function deleteAgendaEventTodoTask(
  taskId: string,
  options: MetaOptions = {},
): Promise<void> {
  const response = await agendaFetch(`/api/event-todos/${taskId}`, {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ meta: options.meta }),
  });
  await parseJsonResponse(response);
}

export async function listAgendaTodoLists(
  agendaId: string,
  options: ClientOptions & { archives?: boolean } = {},
): Promise<AgendaTodoListRecord[]> {
  const response = await agendaFetch(
    `/api/agendas/${agendaId}/todo-lists${toQuery({
      archives: options.archives ? 'true' : undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createAgendaTodoList(
  agendaId: string,
  input: { name: string },
  options: MetaOptions = {},
): Promise<AgendaTodoListRecord> {
  const response = await agendaFetch(`/api/agendas/${agendaId}/todo-lists`, {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function updateAgendaTodoList(
  listId: string,
  input: { name: string },
  options: MetaOptions = {},
): Promise<AgendaTodoListRecord> {
  const response = await agendaFetch(`/api/todo-lists/${listId}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function deleteAgendaTodoList(
  listId: string,
  options: MetaOptions = {},
): Promise<void> {
  const response = await agendaFetch(`/api/todo-lists/${listId}`, {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ meta: options.meta }),
  });
  await parseJsonResponse(response);
}

export async function createAgendaTodoCategory(
  listId: string,
  input: { name: string },
  options: MetaOptions = {},
): Promise<AgendaTodoCategoryRecord> {
  const response = await agendaFetch(`/api/todo-lists/${listId}/categories`, {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function updateAgendaTodoCategory(
  categoryId: string,
  input: { name: string },
  options: MetaOptions = {},
): Promise<AgendaTodoCategoryRecord> {
  const response = await agendaFetch(`/api/todo-categories/${categoryId}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function deleteAgendaTodoCategory(
  categoryId: string,
  options: MetaOptions = {},
): Promise<void> {
  const response = await agendaFetch(`/api/todo-categories/${categoryId}`, {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ meta: options.meta }),
  });
  await parseJsonResponse(response);
}

export async function createAgendaTodoTask(
  categoryId: string,
  input: { title: string; description?: string | null },
  options: MetaOptions = {},
): Promise<AgendaTodoTaskRecord> {
  const response = await agendaFetch(
    `/api/todo-categories/${categoryId}/tasks`,
    {
      method: 'POST',
      cookieHeader: options.cookieHeader,
      body: JSON.stringify({ ...input, meta: options.meta }),
    },
  );
  return parseJsonResponse(response);
}

export async function updateAgendaTodoTask(
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    completed?: boolean;
    categoryId?: string;
  },
  options: MetaOptions = {},
): Promise<AgendaTodoTaskRecord> {
  const response = await agendaFetch(`/api/todo-tasks/${taskId}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function deleteAgendaTodoTask(
  taskId: string,
  options: MetaOptions = {},
): Promise<void> {
  const response = await agendaFetch(`/api/todo-tasks/${taskId}`, {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ meta: options.meta }),
  });
  await parseJsonResponse(response);
}

export async function reorderAgendaTodoCategories(
  items: { id: string; order: number }[],
  options: MetaOptions = {},
): Promise<{ success: true }> {
  const response = await agendaFetch('/api/todo-categories/reorder', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ items, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export async function moveAgendaTodoTask(
  input: {
    taskId: string;
    sourceCategoryId: string;
    targetCategoryId: string;
    sourceOrders: { id: string; order: number }[];
    targetOrders: { id: string; order: number }[];
  },
  options: MetaOptions = {},
): Promise<{ success: true }> {
  const response = await agendaFetch('/api/todo-tasks/move', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ ...input, meta: options.meta }),
  });
  return parseJsonResponse(response);
}

export function getAgendaStreamUrl(params: AgendaScopeParams): string {
  return `${getAgendaUrl()}/api/stream${toQuery(params)}`;
}
