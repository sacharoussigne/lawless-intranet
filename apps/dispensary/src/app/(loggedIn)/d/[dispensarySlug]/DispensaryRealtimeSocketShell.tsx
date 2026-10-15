'use client';

import { useCallback, type ReactNode } from 'react';
import { REALTIME_DOMAIN } from '@lawless-intranet/realtime';
import {
  fetchRealtimeToken,
  RealtimeSocketProvider,
  useOptionalRealtimeSocket,
  useRealtimeSocketEvents,
} from '@lawless-intranet/realtime/socket';

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

/** Websocket transport for every realtime domain of the dispensary. */
export function DispensaryRealtimeSocketShell({
  dispensarySlug,
  url,
  children,
}: {
  dispensarySlug: string;
  /** REALTIME_PUBLIC_URL (ws://localhost:3007 in dev), read at runtime by the server layout. Empty disables. */
  url: string;
  children: ReactNode;
}) {
  const getToken = useCallback(
    () => fetchRealtimeToken(`/api/d/${encodeURIComponent(dispensarySlug)}/realtime-token`),
    [dispensarySlug],
  );

  return (
    <RealtimeSocketProvider url={url} getToken={getToken} clientIdKey="dispensary">
      <RealtimeAccessSync />
      {children}
    </RealtimeSocketProvider>
  );
}
