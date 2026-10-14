import type { ReadRegistry } from '@lawless-intranet/host-kit/read';
import { listDispensaryWeeklyActivities, listDispensaryWeeklyActivityTargets } from '@/app/_actions/dispensaryWeeklyActivity';
import { getAgendaEvent, listAgendaEvents } from '@/app/_actions/agenda/events';
import { listAgendaEventTodoTasks } from '@/app/_actions/agenda/eventTodos';
import { searchDispensaryUsersForAgenda } from '@/app/_actions/agenda/members';
import { listAgendaTodoLists } from '@/app/_actions/agenda/todoLists';
import { getOrdersPage } from '@/app/_actions/orders';
import { listWeeklySales } from '@/app/_actions/sales';

/**
 * Reads exposed as GET (`/api/d/<slug>/read/<query>`) for React Query refetches.
 * Server actions run one at a time per tab, in the navigation queue; these run
 * in parallel. Each entry reuses the read action as-is: auth, tenant, feature
 * and permission checks stay in the action. Only the keys listed here exist.
 */
export const readRoutes = {
  weeklyActivities: (slug: string, input: { periodStart: Date; periodEnd: Date }) =>
    listDispensaryWeeklyActivities(slug, input),
  weeklyActivityTargets: (slug: string, _input?: undefined) =>
    listDispensaryWeeklyActivityTargets(slug),
  weeklySales: (slug: string, input: { weekDate?: Date }) => listWeeklySales(slug, input?.weekDate),
  ordersPage: (slug: string, input: Parameters<typeof getOrdersPage>[1]) => getOrdersPage(slug, input),

  // Agenda and to-dos (agenda-ui, see lib/agenda/agendaUiActions)
  agendaEvents: (slug: string, input: Parameters<typeof listAgendaEvents>[1]) =>
    listAgendaEvents(slug, input),
  agendaEvent: (slug: string, input: { eventId: string }) => getAgendaEvent(slug, input?.eventId),
  agendaTodoLists: (slug: string, input: { agendaId: string; archives?: boolean }) =>
    listAgendaTodoLists(slug, input?.agendaId, { archives: input?.archives }),
  agendaEventTodoTasks: (slug: string, input: { eventId: string }) =>
    listAgendaEventTodoTasks(slug, input?.eventId),
  agendaUserSearch: (slug: string, input: { query: string }) =>
    searchDispensaryUsersForAgenda(slug, input?.query),
} satisfies ReadRegistry;

export type ReadRoutes = typeof readRoutes;
