'use client';

import { useContext, useEffect, useRef } from 'react';
import {
  WeeklyActivityRealtimeContext,
} from '@/lib/dispensaryWeeklyActivity/realtime/client/WeeklyActivityRealtimeProvider';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';

type UseWeeklyActivityRealtimeOptions = {
  enabled?: boolean;
  onChange?: (event: WeeklyActivityRealtimeEvent) => void;
};

export function useWeeklyActivityRealtime({
  enabled = true,
  onChange,
}: UseWeeklyActivityRealtimeOptions) {
  const context = useContext(WeeklyActivityRealtimeContext);
  const handlersRef = useRef({ onChange });

  useEffect(() => {
    handlersRef.current = { onChange };
  }, [onChange]);

  useEffect(() => {
    if (!context) return;
    return context.subscribe({
      enabled,
      onChange: (event) => handlersRef.current.onChange?.(event),
    });
  }, [context, enabled]);

  return { clientId: context?.clientId ?? '' };
}
