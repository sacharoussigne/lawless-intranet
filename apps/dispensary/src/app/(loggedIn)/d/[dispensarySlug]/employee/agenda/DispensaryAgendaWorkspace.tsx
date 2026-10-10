'use client';

import { useMemo, useState } from 'react';
import { createDispensaryAgendaActions } from '@/lib/agenda/agendaUiActions';
import { tenantRoutes } from '@/types/routes';
import {
  AgendaUiProvider,
  AgendaWorkspace,
  type AgendaCalendarRange,
  type AgendaEventDTO,
  type AgendaSummaryDTO,
  type AgendaTodoListDTO,
} from '@lawless-intranet/agenda-ui';
import { AgendaMembersModal } from './components/AgendaMembersModal';

type DispensaryAgendaWorkspaceProps = {
  dispensarySlug: string;
  agendas: AgendaSummaryDTO[];
  initialAgendaId: string | null;
  initialEvents: AgendaEventDTO[];
  initialEventsRange: AgendaCalendarRange;
  initialTodoLists: AgendaTodoListDTO[];
  isAdmin: boolean;
  /** Phones: calendar (Agenda tab) or to-do lists (Tâches tab). */
  mobileView: 'calendar' | 'tasks';
};

export function DispensaryAgendaWorkspace({
  dispensarySlug,
  agendas,
  initialAgendaId,
  initialEvents,
  initialEventsRange,
  initialTodoLists,
  isAdmin,
  mobileView,
}: DispensaryAgendaWorkspaceProps) {
  const actions = useMemo(
    () => createDispensaryAgendaActions(dispensarySlug),
    [dispensarySlug],
  );

  const [membersOpen, setMembersOpen] = useState(false);
  const [membersAgenda, setMembersAgenda] = useState<{
    id: string;
    name: string;
  } | null>(null);

  return (
    <AgendaUiProvider
      scopeKey={dispensarySlug}
      actions={actions}
      adminHref={tenantRoutes(dispensarySlug).admin.agendas}
    >
      <AgendaWorkspace
        agendas={agendas}
        initialAgendaId={initialAgendaId}
        initialEvents={initialEvents}
        initialEventsRange={initialEventsRange}
        initialTodoLists={initialTodoLists}
        isAdmin={isAdmin}
        mobileView={mobileView}
        onManageMembers={(agenda) => {
          setMembersAgenda(agenda);
          setMembersOpen(true);
        }}
      />
      <AgendaMembersModal
        opened={membersOpen}
        onClose={() => setMembersOpen(false)}
        dispensarySlug={dispensarySlug}
        agendaId={membersAgenda?.id ?? null}
        agendaName={membersAgenda?.name ?? ''}
      />
    </AgendaUiProvider>
  );
}
