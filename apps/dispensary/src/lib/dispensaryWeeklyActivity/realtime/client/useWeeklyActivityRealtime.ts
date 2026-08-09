'use client';

import { useCallback } from 'react';
import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import { useRealtimeSubscription } from '@lawless-intranet/realtime/client';
import { fromWeeklyActivityRealtimeEnvelope } from '@/lib/dispensaryWeeklyActivity/realtime/envelope';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';

type UseWeeklyActivityRealtimeOptions = {
  enabled?: boolean;
  onChange?: (event: WeeklyActivityRealtimeEvent) => void;
};

const DOMAINS = [REALTIME_DOMAIN.weeklyActivity] as const;

export function useWeeklyActivityRealtime({
  enabled = true,
  onChange,
}: UseWeeklyActivityRealtimeOptions) {
  const handleEvent = useCallback(
    (envelope: RealtimeEnvelope) => {
      onChange?.(fromWeeklyActivityRealtimeEnvelope(envelope));
    },
    [onChange],
  );

  return useRealtimeSubscription({
    enabled,
    domains: DOMAINS,
    onEvent: handleEvent,
  });
}
