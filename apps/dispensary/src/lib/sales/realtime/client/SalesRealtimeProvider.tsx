'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getOrCreateSalesClientId } from '@/lib/sales/realtime/client/clientId';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';

type RealtimeHandler = (event: WeeklySalesRealtimeEvent) => void;

type RealtimeSubscription = {
  enabled: boolean;
  onChange?: RealtimeHandler;
};

type SalesRealtimeContextValue = {
  clientId: string;
  subscribe: (subscription: RealtimeSubscription) => () => void;
};

const SalesRealtimeContext = createContext<SalesRealtimeContextValue | null>(null);

export { SalesRealtimeContext };

export function SalesRealtimeProvider({
  streamUrl,
  children,
}: {
  streamUrl: string;
  children: ReactNode;
}) {
  const [clientId] = useState(() => getOrCreateSalesClientId());
  const subscriptionsRef = useRef(new Map<number, RealtimeSubscription>());
  const nextSubscriptionIdRef = useRef(0);

  const subscribe = useCallback((subscription: RealtimeSubscription) => {
    const id = nextSubscriptionIdRef.current++;
    subscriptionsRef.current.set(id, subscription);

    return () => {
      subscriptionsRef.current.delete(id);
    };
  }, []);

  useEffect(() => {
    if (!streamUrl) return;

    const eventSource = new EventSource(streamUrl);

    const handleChange = (message: MessageEvent<string>) => {
      try {
        const data = JSON.parse(message.data) as WeeklySalesRealtimeEvent;
        if (data.originClientId && data.originClientId === clientId) {
          return;
        }

        for (const subscription of subscriptionsRef.current.values()) {
          if (!subscription.enabled) continue;
          if (data.type === 'weeklySales') {
            subscription.onChange?.(data);
          }
        }
      } catch {
        // Ignore malformed payloads.
      }
    };

    eventSource.addEventListener('change', handleChange);

    return () => {
      eventSource.removeEventListener('change', handleChange);
      eventSource.close();
    };
  }, [clientId, streamUrl]);

  return (
    <SalesRealtimeContext.Provider value={{ clientId, subscribe }}>
      {children}
    </SalesRealtimeContext.Provider>
  );
}

export function useSalesRealtimeContext(): SalesRealtimeContextValue {
  const context = useContext(SalesRealtimeContext);
  if (!context) {
    throw new Error('useSalesRealtimeContext must be used within SalesRealtimeProvider');
  }
  return context;
}

export function useOptionalSalesRealtimeClientId(): string | undefined {
  return useContext(SalesRealtimeContext)?.clientId;
}
