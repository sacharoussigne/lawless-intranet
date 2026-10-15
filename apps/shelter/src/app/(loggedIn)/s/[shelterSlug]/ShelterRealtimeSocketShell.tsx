'use client';

import { useCallback, type ReactNode } from 'react';
import { fetchRealtimeToken, RealtimeSocketProvider } from '@lawless-intranet/realtime/socket';

/** Websocket transport for every realtime domain of the shelter (media library, waitlist). */
export function ShelterRealtimeSocketShell({
  shelterSlug,
  url,
  children,
}: {
  shelterSlug: string;
  /** REALTIME_PUBLIC_URL (ws://localhost:3007 in dev), read at runtime by the server layout. Empty disables. */
  url: string;
  children: ReactNode;
}) {
  const getToken = useCallback(
    () => fetchRealtimeToken(`/api/s/${encodeURIComponent(shelterSlug)}/realtime-token`),
    [shelterSlug],
  );

  return (
    <RealtimeSocketProvider url={url} getToken={getToken} clientIdKey="shelter">
      {children}
    </RealtimeSocketProvider>
  );
}
