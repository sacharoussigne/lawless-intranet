'use client';

import { useMemo, useState } from 'react';
import { createBusinessAgendaActions } from '@/lib/agenda/agendaUiActions';
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

type BusinessAgendaWorkspaceProps = {
  businessSlug: string;
  agendas: AgendaSummaryDTO[];
  initialAgendaId: string | null;
  initialEvents: AgendaEventDTO[];
  initialEventsRange: AgendaCalendarRange;
  initialTodoLists: AgendaTodoListDTO[];
  isAdmin: boolean;
  /** Phones: calendar (Agenda tab) or to-do lists (Tâches tab). */
  mobileView: 'calendar' | 'tasks';
};

export function BusinessAgendaWorkspace({
  businessSlug,
  agendas,
  initialAgendaId,
  initialEvents,
  initialEventsRange,
  initialTodoLists,
  isAdmin,
  mobileView,
}: BusinessAgendaWorkspaceProps) {
  const actions = useMemo(
    () => createBusinessAgendaActions(businessSlug),
    [businessSlug],
  );

  const [membersOpen, setMembersOpen] = useState(false);
  const [membersAgenda, setMembersAgenda] = useState<{
    id: string;
    name: string;
  } | null>(null);

  return (
    <AgendaUiProvider
      scopeKey={businessSlug}
      actions={actions}
      adminHref={tenantRoutes(businessSlug).admin.agendas}
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
        businessSlug={businessSlug}
        agendaId={membersAgenda?.id ?? null}
        agendaName={membersAgenda?.name ?? ''}
      />
    </AgendaUiProvider>
  );
}
