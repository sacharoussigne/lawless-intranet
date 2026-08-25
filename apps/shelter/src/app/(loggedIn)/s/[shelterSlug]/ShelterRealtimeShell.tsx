'use client';

import { RealtimeProvider } from '@lawless-intranet/realtime/client';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import type { ReactNode } from 'react';

export function ShelterRealtimeShell({ children }: { children: ReactNode }) {
  const { shelterSlug, permissions } = usePermissions();
  const streamEnabled = Boolean(shelterSlug) && Boolean(permissions?.waitlist.manage);

  if (!streamEnabled || !shelterSlug) {
    return children;
  }

  return (
    <RealtimeProvider
      streamUrl={`/api/s/${encodeURIComponent(shelterSlug)}/realtime/stream`}
      clientIdKey="shelter"
    >
      {children}
    </RealtimeProvider>
  );
}
