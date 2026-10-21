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

export function createBusinessAgendaActions(
  businessSlug: string,
): AgendaUiActions {
  return {
    // Reads over GET (lib/read): they run in parallel, not in the server action queue.
    listEvents: (input) => fetchRead(businessSlug, 'agendaEvents', input),
    getEvent: (eventId) => fetchRead(businessSlug, 'agendaEvent', { eventId }),
    createEvent: (input, meta) => createAgendaEvent(businessSlug, input, meta),
    updateEvent: (input, meta) => updateAgendaEvent(businessSlug, input, meta),
    deleteEvent: (id, meta) => deleteAgendaEvent(businessSlug, id, meta),

    listTodoLists: (agendaId, options) =>
      fetchRead(businessSlug, 'agendaTodoLists', { agendaId, archives: options?.archives }),
    createTodoList: (input, meta) =>
      createAgendaTodoList(businessSlug, input, meta),
    updateTodoList: (input, meta) =>
      updateAgendaTodoList(businessSlug, input, meta),
    deleteTodoList: (id, meta) =>
      deleteAgendaTodoList(businessSlug, id, meta),
    createTodoCategory: (input, meta) =>
      createAgendaTodoCategory(businessSlug, input, meta),
    updateTodoCategory: (input, meta) =>
      updateAgendaTodoCategory(businessSlug, input, meta),
    deleteTodoCategory: (id, meta) =>
      deleteAgendaTodoCategory(businessSlug, id, meta),
    createTodoTask: (input, meta) =>
      createAgendaTodoTask(businessSlug, input, meta),
    updateTodoTask: (input, meta) =>
      updateAgendaTodoTask(businessSlug, input, meta),
    deleteTodoTask: (id, meta) =>
      deleteAgendaTodoTask(businessSlug, id, meta),
    reorderTodoCategories: (input, meta) =>
      reorderAgendaTodoCategories(businessSlug, input, meta),
    moveTodoTask: (input, meta) =>
      moveAgendaTodoTask(businessSlug, input, meta),

    listEventTodoTasks: (eventId) =>
      fetchRead(businessSlug, 'agendaEventTodoTasks', { eventId }),
    createEventTodoTask: (input, meta) =>
      createAgendaEventTodoTask(businessSlug, input, meta),
    updateEventTodoTask: (input, meta) =>
      updateAgendaEventTodoTask(businessSlug, input, meta),
    deleteEventTodoTask: (id, meta) =>
      deleteAgendaEventTodoTask(businessSlug, id, meta),

    searchUsers: (query) => fetchRead(businessSlug, 'agendaUserSearch', { query }),
  };
}
