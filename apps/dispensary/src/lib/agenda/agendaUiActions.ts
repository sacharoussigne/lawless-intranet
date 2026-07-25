import {
  createAgendaEvent,
  deleteAgendaEvent,
  getAgendaEvent,
  listAgendaEvents,
  updateAgendaEvent,
} from '@/app/_actions/agenda/events';
import {
  createAgendaEventTodoTask,
  deleteAgendaEventTodoTask,
  listAgendaEventTodoTasks,
  updateAgendaEventTodoTask,
} from '@/app/_actions/agenda/eventTodos';
import { searchDispensaryUsersForAgenda } from '@/app/_actions/agenda/members';
import {
  createAgendaTodoCategory,
  createAgendaTodoList,
  createAgendaTodoTask,
  deleteAgendaTodoCategory,
  deleteAgendaTodoList,
  deleteAgendaTodoTask,
  listAgendaTodoLists,
  moveAgendaTodoTask,
  reorderAgendaTodoCategories,
  updateAgendaTodoCategory,
  updateAgendaTodoList,
  updateAgendaTodoTask,
} from '@/app/_actions/agenda/todoLists';
import type { AgendaUiActions } from '@lawless-intranet/agenda-ui';

export function createDispensaryAgendaActions(
  dispensarySlug: string,
): AgendaUiActions {
  return {
    listEvents: (input) => listAgendaEvents(dispensarySlug, input),
    getEvent: (eventId) => getAgendaEvent(dispensarySlug, eventId),
    createEvent: (input, meta) => createAgendaEvent(dispensarySlug, input, meta),
    updateEvent: (input, meta) => updateAgendaEvent(dispensarySlug, input, meta),
    deleteEvent: (id, meta) => deleteAgendaEvent(dispensarySlug, id, meta),

    listTodoLists: (agendaId, options) =>
      listAgendaTodoLists(dispensarySlug, agendaId, options),
    createTodoList: (input, meta) =>
      createAgendaTodoList(dispensarySlug, input, meta),
    updateTodoList: (input, meta) =>
      updateAgendaTodoList(dispensarySlug, input, meta),
    deleteTodoList: (id, meta) =>
      deleteAgendaTodoList(dispensarySlug, id, meta),
    createTodoCategory: (input, meta) =>
      createAgendaTodoCategory(dispensarySlug, input, meta),
    updateTodoCategory: (input, meta) =>
      updateAgendaTodoCategory(dispensarySlug, input, meta),
    deleteTodoCategory: (id, meta) =>
      deleteAgendaTodoCategory(dispensarySlug, id, meta),
    createTodoTask: (input, meta) =>
      createAgendaTodoTask(dispensarySlug, input, meta),
    updateTodoTask: (input, meta) =>
      updateAgendaTodoTask(dispensarySlug, input, meta),
    deleteTodoTask: (id, meta) =>
      deleteAgendaTodoTask(dispensarySlug, id, meta),
    reorderTodoCategories: (input, meta) =>
      reorderAgendaTodoCategories(dispensarySlug, input, meta),
    moveTodoTask: (input, meta) =>
      moveAgendaTodoTask(dispensarySlug, input, meta),

    listEventTodoTasks: (eventId) =>
      listAgendaEventTodoTasks(dispensarySlug, eventId),
    createEventTodoTask: (input, meta) =>
      createAgendaEventTodoTask(dispensarySlug, input, meta),
    updateEventTodoTask: (input, meta) =>
      updateAgendaEventTodoTask(dispensarySlug, input, meta),
    deleteEventTodoTask: (id, meta) =>
      deleteAgendaEventTodoTask(dispensarySlug, id, meta),

    searchUsers: (query) => searchDispensaryUsersForAgenda(dispensarySlug, query),
  };
}
