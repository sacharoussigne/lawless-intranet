'use client';

import { useCallback, type ReactNode } from 'react';
import { REALTIME_DOMAIN } from '@lawless-intranet/realtime';
import {
  RealtimeSocketProvider,
  useOptionalRealtimeSocket,
  useRealtimeSocketEvents,
} from '@lawless-intranet/realtime/socket';
import { getRealtimeToken } from '@/app/_actions/realtime';

const ACCESS_TYPES = ['access'] as const;
const AGENDA_DOMAINS = [REALTIME_DOMAIN.agenda] as const;

/** Access changed: fetch a new token so the topic set matches the new permissions. */
function RealtimeAccessSync() {
  const socket = useOptionalRealtimeSocket();
  const refreshAccess = socket?.refreshAccess;

  const handleAccessChange = useCallback(() => {
    refreshAccess?.();
  }, [refreshAccess]);

  useRealtimeSocketEvents({
    domains: AGENDA_DOMAINS,
    types: ACCESS_TYPES,
    onEvent: handleAccessChange,
  });

  return null;
}

/**
 * Websocket transport (agenda, todos). Other domains still use the SSE stream
 * of DispensaryRealtimeShell during the migration.
 */
export function DispensaryRealtimeSocketShell({
  dispensarySlug,
  url,
  children,
}: {
  dispensarySlug: string;
  /** REALTIME_PUBLIC_URL, read at runtime by the server layout. Empty disables. */
  url: string;
  children: ReactNode;
}) {
  const getToken = useCallback(async () => {
    const result = await getRealtimeToken(dispensarySlug);
    return result.status === 200 && 'data' in result && result.data ? result.data : null;
  }, [dispensarySlug]);

  return (
    <RealtimeSocketProvider url={url} getToken={getToken} clientIdKey="dispensary">
      <RealtimeAccessSync />
      {children}
    </RealtimeSocketProvider>
  );
}
