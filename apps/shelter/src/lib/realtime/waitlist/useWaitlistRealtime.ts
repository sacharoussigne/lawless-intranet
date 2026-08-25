'use client';

import { useCallback } from 'react';
import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import { useRealtimeSubscription } from '@lawless-intranet/realtime/client';
import { fromWaitlistRealtimeEnvelope } from '@/lib/realtime/waitlist/envelope';
import type { WaitlistRealtimeEvent } from '@/lib/realtime/waitlist/types';

type UseWaitlistRealtimeOptions = {
  enabled?: boolean;
  onChange?: (event: WaitlistRealtimeEvent) => void;
};

const DOMAINS = [REALTIME_DOMAIN.waitlist] as const;

export function useWaitlistRealtime({
  enabled = true,
  onChange,
}: UseWaitlistRealtimeOptions) {
  const handleEvent = useCallback(
    (envelope: RealtimeEnvelope) => {
      onChange?.(fromWaitlistRealtimeEnvelope(envelope));
    },
    [onChange],
  );

  return useRealtimeSubscription({
    enabled,
    domains: DOMAINS,
    onEvent: handleEvent,
  });
}
