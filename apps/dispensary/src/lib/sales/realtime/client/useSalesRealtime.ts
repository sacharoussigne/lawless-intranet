'use client';

import { useCallback } from 'react';
import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import { useRealtimeSubscription } from '@lawless-intranet/realtime/client';
import { fromWeeklySalesRealtimeEnvelope } from '@/lib/sales/realtime/envelope';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';

type UseSalesRealtimeOptions = {
  enabled?: boolean;
  onChange?: (event: WeeklySalesRealtimeEvent) => void;
};

const DOMAINS = [REALTIME_DOMAIN.sales] as const;

export function useSalesRealtime({
  enabled = true,
  onChange,
}: UseSalesRealtimeOptions) {
  const handleEvent = useCallback(
    (envelope: RealtimeEnvelope) => {
      onChange?.(fromWeeklySalesRealtimeEnvelope(envelope));
    },
    [onChange],
  );

  return useRealtimeSubscription({
    enabled,
    domains: DOMAINS,
    onEvent: handleEvent,
  });
}
