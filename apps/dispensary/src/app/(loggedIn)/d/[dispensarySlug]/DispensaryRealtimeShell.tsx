'use client';

import { AgendaRealtimeProvider } from '@lawless-intranet/agenda-ui';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import type { ReactNode } from 'react';

export function DispensaryRealtimeShell({ children }: { children: ReactNode }) {
  const { dispensarySlug, agendaModuleAccess } = usePermissions();

  if (!agendaModuleAccess || !dispensarySlug) {
    return children;
  }

  return (
    <AgendaRealtimeProvider
      streamUrl={`/api/d/${encodeURIComponent(dispensarySlug)}/agenda/stream`}
    >
      {children}
    </AgendaRealtimeProvider>
  );
}
