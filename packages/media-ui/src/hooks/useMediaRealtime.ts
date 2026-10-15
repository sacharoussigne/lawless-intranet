'use client';

import { REALTIME_DOMAIN } from '@lawless-intranet/realtime';
import { useRealtimeSocketEvents, useRealtimeSocketResync } from '@lawless-intranet/realtime/socket';
import { useInvalidateMedia } from './useMediaQueries';

const DOMAINS = [REALTIME_DOMAIN.media] as const;

/**
 * Live updates when the host mounts a RealtimeSocketProvider (no-op otherwise):
 * any change in the library, or a reconnection, refreshes the cached folders.
 */
export function useMediaRealtime() {
  const invalidate = useInvalidateMedia();
  // An upload of N files sends N events: refetch once.
  useRealtimeSocketEvents({ domains: DOMAINS, coalesceMs: 300, onEvent: () => void invalidate() });
  useRealtimeSocketResync(() => void invalidate());
}
