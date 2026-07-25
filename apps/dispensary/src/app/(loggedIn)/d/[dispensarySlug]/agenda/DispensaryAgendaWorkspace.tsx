'use client';

import { createDispensaryAgendaActions } from '@/lib/agenda/agendaUiActions';
import { tenantRoutes } from '@/types/routes';
import {
  AgendaUiProvider,
  AgendaWorkspace,
  type AgendaEventDTO,
  type AgendaSummaryDTO,
  type AgendaTodoListDTO,
} from '@lawless-intranet/agenda-ui';
import { useMemo } from 'react';

type DispensaryAgendaWorkspaceProps = {
  dispensarySlug: string;
  agendas: AgendaSummaryDTO[];
  initialAgendaId: string | null;
  initialEvents: AgendaEventDTO[];
  initialTodoLists: AgendaTodoListDTO[];
  isAdmin: boolean;
};

export function DispensaryAgendaWorkspace({
  dispensarySlug,
  agendas,
  initialAgendaId,
  initialEvents,
  initialTodoLists,
  isAdmin,
}: DispensaryAgendaWorkspaceProps) {
  const actions = useMemo(
    () => createDispensaryAgendaActions(dispensarySlug),
    [dispensarySlug],
  );

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
        initialTodoLists={initialTodoLists}
        isAdmin={isAdmin}
      />
    </AgendaUiProvider>
  );
}
