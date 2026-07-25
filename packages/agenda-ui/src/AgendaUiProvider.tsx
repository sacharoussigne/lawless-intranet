'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  AgendaEventDTO,
  AgendaEventTodoTaskDTO,
  AgendaTodoCategoryDTO,
  AgendaTodoListDTO,
  AgendaTodoTaskDTO,
} from './types';
import type { AgendaMutationMeta } from './realtime/mutationMeta';
import { getOrCreateAgendaClientId } from './realtime/clientId';
import type { AgendaActionResult } from './runAgendaAction';

export type { AgendaActionResult } from './runAgendaAction';

export type AgendaUiUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

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

export type UpdateAgendaEventInput = CreateAgendaEventInput & {
  id: string;
};

export type AgendaUiActions = {
  listEvents: (input: {
    agendaId?: string;
    rangeStart: string;
    rangeEnd: string;
  }) => Promise<AgendaActionResult<AgendaEventDTO[]>>;

  getEvent: (eventId: string) => Promise<AgendaActionResult<AgendaEventDTO>>;

  createEvent: (
    input: CreateAgendaEventInput,
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaEventDTO>>;

  updateEvent: (
    input: UpdateAgendaEventInput,
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaEventDTO>>;

  deleteEvent: (
    id: string,
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult>;

  listTodoLists: (
    agendaId: string,
    options?: { archives?: boolean },
  ) => Promise<AgendaActionResult<AgendaTodoListDTO[]>>;

  createTodoList: (
    input: { agendaId: string; name: string },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaTodoListDTO>>;

  updateTodoList: (
    input: { id: string; name: string },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaTodoListDTO>>;

  deleteTodoList: (
    id: string,
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult>;

  createTodoCategory: (
    input: { listId: string; name: string },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaTodoCategoryDTO>>;

  updateTodoCategory: (
    input: { id: string; name: string },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaTodoCategoryDTO>>;

  deleteTodoCategory: (
    id: string,
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult>;

  createTodoTask: (
    input: { categoryId: string; title: string; description?: string | null },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaTodoTaskDTO>>;

  updateTodoTask: (
    input: {
      id: string;
      title?: string;
      description?: string | null;
      completed?: boolean;
      categoryId?: string;
    },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaTodoTaskDTO>>;

  deleteTodoTask: (
    id: string,
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult>;

  reorderTodoCategories: (
    input: { items: { id: string; order: number }[] },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<{ success: true }>>;

  moveTodoTask: (
    input: {
      taskId: string;
      sourceCategoryId: string;
      targetCategoryId: string;
      sourceOrders: { id: string; order: number }[];
      targetOrders: { id: string; order: number }[];
    },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<{ success: true }>>;

  listEventTodoTasks: (
    eventId: string,
  ) => Promise<AgendaActionResult<AgendaEventTodoTaskDTO[]>>;

  createEventTodoTask: (
    input: { eventId: string; title: string; description?: string | null },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaEventTodoTaskDTO>>;

  updateEventTodoTask: (
    input: {
      id: string;
      title?: string;
      description?: string | null;
      completed?: boolean;
    },
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult<AgendaEventTodoTaskDTO>>;

  deleteEventTodoTask: (
    id: string,
    meta?: AgendaMutationMeta,
  ) => Promise<AgendaActionResult>;

  searchUsers: (query: string) => Promise<AgendaActionResult<AgendaUiUser[]>>;
};

export type AgendaUiContextValue = {
  /** Opaque tenant key for localStorage prefs (dispensarySlug or commerce id) */
  scopeKey: string;
  actions: AgendaUiActions;
  /** Optional link shown when isAdmin — e.g. /d/xxx/admin/agendas */
  adminHref?: string | null;
  clientId: string;
};

const AgendaUiContext = createContext<AgendaUiContextValue | null>(null);

export type AgendaUiProviderProps = {
  scopeKey: string;
  actions: AgendaUiActions;
  adminHref?: string | null;
  /** Prefer host-provided clientId from AgendaRealtimeProvider when nested */
  clientId?: string;
  children: ReactNode;
};

export function AgendaUiProvider({
  scopeKey,
  actions,
  adminHref = null,
  clientId: clientIdProp,
  children,
}: AgendaUiProviderProps) {
  const value = useMemo<AgendaUiContextValue>(
    () => ({
      scopeKey,
      actions,
      adminHref,
      clientId: clientIdProp ?? getOrCreateAgendaClientId(),
    }),
    [scopeKey, actions, adminHref, clientIdProp],
  );

  return (
    <AgendaUiContext.Provider value={value}>{children}</AgendaUiContext.Provider>
  );
}

export function useAgendaUi(): AgendaUiContextValue {
  const context = useContext(AgendaUiContext);
  if (!context) {
    throw new Error('useAgendaUi must be used within AgendaUiProvider');
  }
  return context;
}
