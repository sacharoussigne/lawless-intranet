import {
  createAgendaEvent,
  deleteAgendaEvent,
  updateAgendaEvent,
} from '@/app/_actions/agenda/events';
import {
  createAgendaEventTodoTask,
  deleteAgendaEventTodoTask,
  updateAgendaEventTodoTask,
} from '@/app/_actions/agenda/eventTodos';
import {
  createAgendaTodoCategory,
  createAgendaTodoList,
  createAgendaTodoTask,
  deleteAgendaTodoCategory,
  deleteAgendaTodoList,
  deleteAgendaTodoTask,
  moveAgendaTodoTask,
  reorderAgendaTodoCategories,
  updateAgendaTodoCategory,
  updateAgendaTodoList,
  updateAgendaTodoTask,
} from '@/app/_actions/agenda/todoLists';
import type { AgendaUiActions } from '@lawless-intranet/agenda-ui';
import { fetchRead } from '@/lib/read/fetchRead';

export function createDispensaryAgendaActions(
  dispensarySlug: string,
): AgendaUiActions {
  return {
    // Reads over GET (lib/read): they run in parallel, not in the server action queue.
    listEvents: (input) => fetchRead(dispensarySlug, 'agendaEvents', input),
    getEvent: (eventId) => fetchRead(dispensarySlug, 'agendaEvent', { eventId }),
    createEvent: (input, meta) => createAgendaEvent(dispensarySlug, input, meta),
    updateEvent: (input, meta) => updateAgendaEvent(dispensarySlug, input, meta),
    deleteEvent: (id, meta) => deleteAgendaEvent(dispensarySlug, id, meta),

    listTodoLists: (agendaId, options) =>
      fetchRead(dispensarySlug, 'agendaTodoLists', { agendaId, archives: options?.archives }),
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
      fetchRead(dispensarySlug, 'agendaEventTodoTasks', { eventId }),
    createEventTodoTask: (input, meta) =>
      createAgendaEventTodoTask(dispensarySlug, input, meta),
    updateEventTodoTask: (input, meta) =>
      updateAgendaEventTodoTask(dispensarySlug, input, meta),
    deleteEventTodoTask: (id, meta) =>
      deleteAgendaEventTodoTask(dispensarySlug, id, meta),

    searchUsers: (query) => fetchRead(dispensarySlug, 'agendaUserSearch', { query }),
  };
}
