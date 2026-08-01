'use client';

import { AgendaRealtimeProvider } from '@lawless-intranet/agenda-ui';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { WeeklyActivityRealtimeProvider } from '@/lib/dispensaryWeeklyActivity/realtime/client/WeeklyActivityRealtimeProvider';
import { SalesRealtimeProvider } from '@/lib/sales/realtime/client/SalesRealtimeProvider';
import type { ReactNode } from 'react';

export function DispensaryRealtimeShell({ children }: { children: ReactNode }) {
  const { dispensarySlug, agendaModuleAccess, permissions, appSettings } = usePermissions();

  let content = children;

  if (agendaModuleAccess && dispensarySlug) {
    content = (
      <AgendaRealtimeProvider
        streamUrl={`/api/d/${encodeURIComponent(dispensarySlug)}/agenda/stream`}
      >
        {content}
      </AgendaRealtimeProvider>
    );
  }

  const weeklyActivityRealtimeEnabled =
    Boolean(dispensarySlug) &&
    appSettings.featureWeeklyDispensaryActivityEnabled &&
    Boolean(permissions?.weeklyDispensaryActivity.view);

  if (weeklyActivityRealtimeEnabled && dispensarySlug) {
    content = (
      <WeeklyActivityRealtimeProvider
        streamUrl={`/api/d/${encodeURIComponent(dispensarySlug)}/weekly-activity/stream`}
      >
        {content}
      </WeeklyActivityRealtimeProvider>
    );
  }

  const salesRealtimeEnabled =
    Boolean(dispensarySlug) &&
    appSettings.featureSalesEnabled &&
    Boolean(permissions?.sales.view);

  if (salesRealtimeEnabled && dispensarySlug) {
    content = (
      <SalesRealtimeProvider
        streamUrl={`/api/d/${encodeURIComponent(dispensarySlug)}/sales/stream`}
      >
        {content}
      </SalesRealtimeProvider>
    );
  }

  return content;
}
