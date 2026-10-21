'use client';

import { useCallback } from 'react';
import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import {
  useOptionalRealtimeSocket,
  useRealtimeSocketEvents,
} from '@lawless-intranet/realtime/socket';
import { fromWeeklySalesRealtimeEnvelope } from '@/lib/sales/realtime/envelope';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';

type UseSalesRealtimeOptions = {
  enabled?: boolean;
  onChange?: (event: WeeklySalesRealtimeEvent) => void;
};

const DOMAINS = [REALTIME_DOMAIN.sales] as const;

/** Sales changes over the websocket; `clientId` tags this tab's mutations so it skips its own echo. */
export function useSalesRealtime({
  enabled = true,
  onChange,
}: UseSalesRealtimeOptions) {
  const socket = useOptionalRealtimeSocket();
  const handleEvent = useCallback(
    (envelope: RealtimeEnvelope) => {
      onChange?.(fromWeeklySalesRealtimeEnvelope(envelope));
    },
    [onChange],
  );

  useRealtimeSocketEvents({
    enabled: enabled && Boolean(onChange),
    domains: DOMAINS,
    onEvent: handleEvent,
  });

  return { clientId: socket?.clientId };
}
