'use client';

import { RealtimeProvider } from '@lawless-intranet/realtime/client';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import type { ReactNode } from 'react';

export function DispensaryRealtimeShell({ children }: { children: ReactNode }) {
  const { dispensarySlug, permissions, appSettings } = usePermissions();

  const weeklyActivityRealtimeEnabled =
    Boolean(dispensarySlug) &&
    appSettings.featureWeeklyDispensaryActivityEnabled &&
    Boolean(permissions?.weeklyDispensaryActivity.view);

  const streamEnabled =
    Boolean(dispensarySlug) &&
    weeklyActivityRealtimeEnabled;

  if (!streamEnabled || !dispensarySlug) {
    return children;
  }

  return (
    <RealtimeProvider
      streamUrl={`/api/d/${encodeURIComponent(dispensarySlug)}/realtime/stream`}
      clientIdKey="dispensary"
    >
      {children}
    </RealtimeProvider>
  );
}
