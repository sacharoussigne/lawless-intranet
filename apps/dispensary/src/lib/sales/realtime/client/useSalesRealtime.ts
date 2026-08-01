'use client';

import { useContext, useEffect, useRef } from 'react';
import { SalesRealtimeContext } from '@/lib/sales/realtime/client/SalesRealtimeProvider';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';

type UseSalesRealtimeOptions = {
  enabled?: boolean;
  onChange?: (event: WeeklySalesRealtimeEvent) => void;
};

export function useSalesRealtime({
  enabled = true,
  onChange,
}: UseSalesRealtimeOptions) {
  const context = useContext(SalesRealtimeContext);
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
