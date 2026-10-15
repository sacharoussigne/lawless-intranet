'use client';

import { useCallback } from 'react';
import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import { useRealtimeSocketEvents } from '@lawless-intranet/realtime/socket';
import { fromOrdersRealtimeEnvelope } from '@/lib/orders/realtime/envelope';
import type { OrdersRealtimeEvent } from '@/lib/orders/realtime/types';

type UseOrdersRealtimeOptions = {
  enabled?: boolean;
  onChange?: (event: OrdersRealtimeEvent) => void;
};

const DOMAINS = [REALTIME_DOMAIN.orders] as const;

export function useOrdersRealtime({
  enabled = true,
  onChange,
}: UseOrdersRealtimeOptions) {
  const handleEvent = useCallback(
    (envelope: RealtimeEnvelope) => {
      onChange?.(fromOrdersRealtimeEnvelope(envelope));
    },
    [onChange],
  );

  useRealtimeSocketEvents({
    enabled,
    domains: DOMAINS,
    coalesceMs: 200,
    onEvent: handleEvent,
  });
}
