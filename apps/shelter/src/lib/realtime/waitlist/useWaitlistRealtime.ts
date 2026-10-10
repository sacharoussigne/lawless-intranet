'use client';

import { useCallback } from 'react';
import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import {
  useRealtimeSocketEvents,
  useRealtimeSocketResync,
} from '@lawless-intranet/realtime/socket';
import { fromWaitlistRealtimeEnvelope } from '@/lib/realtime/waitlist/envelope';
import type { WaitlistRealtimeEvent } from '@/lib/realtime/waitlist/types';

type UseWaitlistRealtimeOptions = {
  enabled?: boolean;
  onChange?: (event: WaitlistRealtimeEvent) => void;
  /** After a websocket reconnect: refetch what may have been missed. */
  onResync?: () => void;
};

const DOMAINS = [REALTIME_DOMAIN.waitlist] as const;

export function useWaitlistRealtime({
  enabled = true,
  onChange,
  onResync,
}: UseWaitlistRealtimeOptions) {
  const handleEvent = useCallback(
    (envelope: RealtimeEnvelope) => {
      onChange?.(fromWaitlistRealtimeEnvelope(envelope));
    },
    [onChange],
  );

  const handleResync = useCallback(() => onResync?.(), [onResync]);

  useRealtimeSocketEvents({
    enabled,
    domains: DOMAINS,
    onEvent: handleEvent,
  });
  useRealtimeSocketResync(handleResync, enabled);
}
