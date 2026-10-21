import { getAgendaCalendarRange, isAgendaCalendarView } from '@lawless-intranet/agenda-ui';
import { getAgendaPageBootstrap } from '@/app/_actions/agenda/agendas';
import { listAgendaEvents } from '@/app/_actions/agenda/events';
import { listAgendaTodoLists } from '@/app/_actions/agenda/todoLists';
import { BusinessAgendaWorkspace } from './BusinessAgendaWorkspace';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

/** Server side of the agenda and tasks pages (two tabs of the phone app, same workspace). */
export async function AgendaPageContent({
  businessSlug,
  mobileView,
  view,
}: {
  businessSlug: string;
  mobileView: 'calendar' | 'tasks';
  /** `?view=` of the URL, so the SSR events match the calendar view (list view on phones). */
  view: string | undefined;
}) {
  const bootstrapResult = await getAgendaPageBootstrap(businessSlug);
  if (bootstrapResult.status !== 200) {
    redirect(tenantRoutes(businessSlug).employee.index);
  }

  const bootstrap =
    bootstrapResult.status === 200 && 'data' in bootstrapResult
      ? bootstrapResult.data
      : null;

  if (!bootstrap?.hasAccess) {
    redirect(tenantRoutes(businessSlug).employee.index);
  }

  const { agendas, isAdmin } = bootstrap;
  const firstAgendaId = agendas[0]?.id;

  // Same range as the calendar's view, so the client reuses this data.
  const initialEventsRange = getAgendaCalendarRange(
    view && isAgendaCalendarView(view) ? view : 'month',
    new Date(),
  );

  const [eventsResult, todosResult] = await Promise.all([
    listAgendaEvents(businessSlug, {
      agendaId: firstAgendaId,
      ...initialEventsRange,
    }),
    firstAgendaId
      ? listAgendaTodoLists(businessSlug, firstAgendaId)
      : Promise.resolve({ status: 200 as const, data: [] }),
  ]);

  return (
    <BusinessAgendaWorkspace
      businessSlug={businessSlug}
      agendas={agendas}
      initialAgendaId={firstAgendaId ?? null}
      initialEvents={
        eventsResult.status === 200 && 'data' in eventsResult
          ? eventsResult.data ?? []
          : []
      }
      initialEventsRange={initialEventsRange}
      initialTodoLists={
        todosResult.status === 200 && 'data' in todosResult
          ? todosResult.data ?? []
          : []
      }
      isAdmin={isAdmin}
      mobileView={mobileView}
    />
  );
}
