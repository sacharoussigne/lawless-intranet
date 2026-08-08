'use client';

import {
  RealtimeProvider,
  useOptionalRealtimeClientId,
  useRealtimeContext,
} from '@lawless-intranet/realtime/client';
import type { ReactNode } from 'react';

/**
 * Host apps should prefer a shared RealtimeProvider (e.g. DispensaryRealtimeShell).
 * This wrapper remains for standalone usage with a dedicated agenda stream URL.
 */
export function AgendaRealtimeProvider({
  streamUrl,
  children,
}: {
  streamUrl?: string;
  children: ReactNode;
}) {
  const parentClientId = useOptionalRealtimeClientId();
  if (parentClientId || !streamUrl) {
    return children;
  }

  return (
    <RealtimeProvider streamUrl={streamUrl} clientIdKey="dispensary">
      {children}
    </RealtimeProvider>
  );
}

export function useAgendaRealtimeContext() {
  return useRealtimeContext();
}
