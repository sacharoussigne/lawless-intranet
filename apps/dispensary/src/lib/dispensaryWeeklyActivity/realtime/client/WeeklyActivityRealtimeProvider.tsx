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
import { getOrCreateWeeklyActivityClientId } from '@/lib/dispensaryWeeklyActivity/realtime/client/clientId';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';

type RealtimeHandler = (event: WeeklyActivityRealtimeEvent) => void;

type RealtimeSubscription = {
  enabled: boolean;
  onChange?: RealtimeHandler;
};

type WeeklyActivityRealtimeContextValue = {
  clientId: string;
  subscribe: (subscription: RealtimeSubscription) => () => void;
};

const WeeklyActivityRealtimeContext = createContext<WeeklyActivityRealtimeContextValue | null>(
  null,
);

export { WeeklyActivityRealtimeContext };

export function WeeklyActivityRealtimeProvider({
  streamUrl,
  children,
}: {
  streamUrl: string;
  children: ReactNode;
}) {
  const [clientId] = useState(() => getOrCreateWeeklyActivityClientId());
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
        const data = JSON.parse(message.data) as WeeklyActivityRealtimeEvent;
        if (data.originClientId && data.originClientId === clientId) {
          return;
        }

        for (const subscription of subscriptionsRef.current.values()) {
          if (!subscription.enabled) continue;
          if (data.type === 'weeklyActivity') {
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
    <WeeklyActivityRealtimeContext.Provider value={{ clientId, subscribe }}>
      {children}
    </WeeklyActivityRealtimeContext.Provider>
  );
}

export function useWeeklyActivityRealtimeContext(): WeeklyActivityRealtimeContextValue {
  const context = useContext(WeeklyActivityRealtimeContext);
  if (!context) {
    throw new Error(
      'useWeeklyActivityRealtimeContext must be used within WeeklyActivityRealtimeProvider',
    );
  }
  return context;
}

export function useOptionalWeeklyActivityRealtimeClientId(): string | undefined {
  return useContext(WeeklyActivityRealtimeContext)?.clientId;
}
