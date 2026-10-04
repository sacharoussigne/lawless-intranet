import { getAgendaCalendarRange } from '@lawless-intranet/agenda-ui';
import { getAgendaPageBootstrap } from '@/app/_actions/agenda/agendas';
import { listAgendaEvents } from '@/app/_actions/agenda/events';
import { listAgendaTodoLists } from '@/app/_actions/agenda/todoLists';
import { DispensaryAgendaWorkspace } from './DispensaryAgendaWorkspace';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;

  const bootstrapResult = await getAgendaPageBootstrap(dispensarySlug);
  if (bootstrapResult.status !== 200) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const bootstrap =
    bootstrapResult.status === 200 && 'data' in bootstrapResult
      ? bootstrapResult.data
      : null;

  if (!bootstrap?.hasAccess) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const { agendas, isAdmin } = bootstrap;
  const firstAgendaId = agendas[0]?.id;

  // Same range as the calendar's default month view, so the client reuses this data.
  const initialEventsRange = getAgendaCalendarRange('month', new Date());

  const [eventsResult, todosResult] = await Promise.all([
    listAgendaEvents(dispensarySlug, {
      agendaId: firstAgendaId,
      ...initialEventsRange,
    }),
    firstAgendaId
      ? listAgendaTodoLists(dispensarySlug, firstAgendaId)
      : Promise.resolve({ status: 200 as const, data: [] }),
  ]);

  return (
    <DispensaryAgendaWorkspace
      dispensarySlug={dispensarySlug}
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
    />
  );
}
