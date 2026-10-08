'use client';

import { useCallback, type ReactNode } from 'react';
import { RealtimeSocketProvider } from '@lawless-intranet/realtime/socket';
import { getRealtimeToken } from '@/app/_actions/realtime';

/**
 * Websocket transport (media library). The waitlist still uses the SSE stream
 * of ShelterRealtimeShell during the migration.
 */
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
  const getToken = useCallback(async () => {
    const result = await getRealtimeToken(shelterSlug);
    return result.status === 200 && 'data' in result && result.data ? result.data : null;
  }, [shelterSlug]);

  return (
    <RealtimeSocketProvider url={url} getToken={getToken} clientIdKey="shelter">
      {children}
    </RealtimeSocketProvider>
  );
}
