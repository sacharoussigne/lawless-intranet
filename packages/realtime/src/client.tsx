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
import { getOrCreateRealtimeClientId } from './clientId';
import type { RealtimeEnvelope } from './types';

type RealtimeHandler = (event: RealtimeEnvelope) => void;
type RealtimeReconnectHandler = () => void;

type RealtimeSubscription = {
  enabled: boolean;
  domains?: string[];
  types?: string[];
  onEvent?: RealtimeHandler;
};

type RealtimeContextValue = {
  clientId: string;
  subscribe: (subscription: RealtimeSubscription) => () => void;
  subscribeReconnect: (handler: RealtimeReconnectHandler) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export { RealtimeContext };

export function RealtimeProvider({
  streamUrl,
  clientIdKey = 'default',
  children,
}: {
  streamUrl: string;
  clientIdKey?: string;
  children: ReactNode;
}) {
  const [clientId] = useState(() => getOrCreateRealtimeClientId(clientIdKey));
  const subscriptionsRef = useRef(new Map<number, RealtimeSubscription>());
  const nextSubscriptionIdRef = useRef(0);
  const reconnectHandlersRef = useRef(new Map<number, RealtimeReconnectHandler>());
  const nextReconnectIdRef = useRef(0);

  const subscribe = useCallback((subscription: RealtimeSubscription) => {
    const id = nextSubscriptionIdRef.current++;
    subscriptionsRef.current.set(id, subscription);

    return () => {
      subscriptionsRef.current.delete(id);
    };
  }, []);

  const subscribeReconnect = useCallback((handler: RealtimeReconnectHandler) => {
    const id = nextReconnectIdRef.current++;
    reconnectHandlersRef.current.set(id, handler);
    return () => {
      reconnectHandlersRef.current.delete(id);
    };
  }, []);

  useEffect(() => {
    if (!streamUrl) return;

    const eventSource = new EventSource(streamUrl);
    let openedOnce = false;

    const handleChange = (message: MessageEvent<string>) => {
      try {
        const data = JSON.parse(message.data) as RealtimeEnvelope;
        if (data.originClientId && data.originClientId === clientId) {
          return;
        }

        for (const subscription of subscriptionsRef.current.values()) {
          if (!subscription.enabled) continue;
          if (
            subscription.domains &&
            subscription.domains.length > 0 &&
            !subscription.domains.includes(data.domain)
          ) {
            continue;
          }
          if (
            subscription.types &&
            subscription.types.length > 0 &&
            !subscription.types.includes(data.type)
          ) {
            continue;
          }
          subscription.onEvent?.(data);
        }
      } catch {
        // Ignore malformed payloads.
      }
    };

    const handleOpen = () => {
      if (!openedOnce) {
        openedOnce = true;
        return;
      }
      for (const handler of reconnectHandlersRef.current.values()) {
        handler();
      }
    };

    eventSource.addEventListener('change', handleChange);
    eventSource.addEventListener('open', handleOpen);

    return () => {
      eventSource.removeEventListener('change', handleChange);
      eventSource.removeEventListener('open', handleOpen);
      eventSource.close();
    };
  }, [clientId, streamUrl]);

  return (
    <RealtimeContext.Provider value={{ clientId, subscribe, subscribeReconnect }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within RealtimeProvider');
  }
  return context;
}

export function useOptionalRealtimeClientId(): string | undefined {
  return useContext(RealtimeContext)?.clientId;
}

export function useRealtimeReconnect(
  onReconnect: () => void,
  enabled = true,
): void {
  const context = useContext(RealtimeContext);
  const handlerRef = useRef(onReconnect);

  useEffect(() => {
    handlerRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!context || !enabled) return;
    return context.subscribeReconnect(() => handlerRef.current());
  }, [context, enabled]);
}

export function useRealtimeSubscription(options: {
  enabled?: boolean;
  domains?: readonly string[];
  types?: readonly string[];
  onEvent?: RealtimeHandler;
}) {
  const context = useContext(RealtimeContext);
  const handlersRef = useRef({ onEvent: options.onEvent });
  const domainsKey = options.domains?.join('\0') ?? '';
  const typesKey = options.types?.join('\0') ?? '';

  useEffect(() => {
    handlersRef.current = { onEvent: options.onEvent };
  }, [options.onEvent]);

  useEffect(() => {
    if (!context) return;
    const domains = domainsKey ? domainsKey.split('\0') : undefined;
    const types = typesKey ? typesKey.split('\0') : undefined;
    return context.subscribe({
      enabled: options.enabled ?? true,
      domains,
      types,
      onEvent: (event) => handlersRef.current.onEvent?.(event),
    });
  }, [context, domainsKey, options.enabled, typesKey]);

  return { clientId: context?.clientId ?? '' };
}
