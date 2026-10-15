'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getOrCreateRealtimeClientId } from './clientId';
import {
  computeReconnectDelay,
  createRealtimeConnection,
  shouldResyncOnReady,
  type RealtimeSocketStatus,
  type RealtimeSocketToken,
} from './connection';
import type { RealtimeEnvelope } from './types';

/**
 * Browser websocket client for the realtime server. The connection loop lives in
 * `./connection` (token reuse, backoff, resync); this file binds it to React and
 * the DOM:
 *
 * - One socket per tab, shared by every `useRealtimeSocketEvents` subscriber.
 * - Wakes the connection when the tab becomes visible again or the network comes back.
 * - `useRealtimeSocketResync` handlers run after a reconnection: consumers
 *   refetch their data, so notifications missed while disconnected are never lost.
 * - `status` lives in its own context (`useRealtimeSocketStatus`), so a
 *   reconnection does not re-render every subscriber.
 */

export type { RealtimeSocketStatus, RealtimeSocketToken };
export { computeReconnectDelay, shouldResyncOnReady };

type EventHandler = (envelope: RealtimeEnvelope, topic: string) => void;

type Subscription = {
  domains?: readonly string[];
  types?: readonly string[];
  onEvent: EventHandler;
};

type RealtimeSocketContextValue = {
  clientId: string;
  subscribe: (subscription: Subscription) => () => void;
  subscribeResync: (handler: () => void) => () => void;
  refreshAccess: () => void;
};

const RealtimeSocketContext = createContext<RealtimeSocketContextValue | null>(null);
const RealtimeSocketStatusContext = createContext<RealtimeSocketStatus>('closed');

export function RealtimeSocketProvider({
  url,
  getToken,
  clientIdKey = 'default',
  children,
}: {
  /** ws:// or wss:// URL of the realtime server; empty disables realtime. */
  url: string;
  getToken: () => Promise<RealtimeSocketToken | null>;
  clientIdKey?: string;
  children: ReactNode;
}) {
  const [clientId] = useState(() => getOrCreateRealtimeClientId(clientIdKey));
  const [status, setStatus] = useState<RealtimeSocketStatus>('connecting');
  const subscriptionsRef = useRef(new Set<Subscription>());
  const resyncHandlersRef = useRef(new Set<() => void>());
  const getTokenRef = useRef(getToken);
  const refreshAccessRef = useRef<() => void>(() => {});

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const subscribe = useCallback((subscription: Subscription) => {
    subscriptionsRef.current.add(subscription);
    return () => {
      subscriptionsRef.current.delete(subscription);
    };
  }, []);

  const subscribeResync = useCallback((handler: () => void) => {
    resyncHandlersRef.current.add(handler);
    return () => {
      resyncHandlersRef.current.delete(handler);
    };
  }, []);

  const refreshAccess = useCallback(() => {
    refreshAccessRef.current();
  }, []);

  useEffect(() => {
    if (!url) {
      return;
    }

    const dispatch = (topic: string, envelope: RealtimeEnvelope) => {
      if (envelope.originClientId && envelope.originClientId === clientId) {
        return;
      }
      for (const subscription of subscriptionsRef.current) {
        if (subscription.domains?.length && !subscription.domains.includes(envelope.domain)) {
          continue;
        }
        if (subscription.types?.length && !subscription.types.includes(envelope.type)) {
          continue;
        }
        try {
          subscription.onEvent(envelope, topic);
        } catch (error) {
          console.error('[realtime] event handler failed', error);
        }
      }
    };

    const runResync = () => {
      for (const handler of resyncHandlersRef.current) {
        try {
          handler();
        } catch (error) {
          console.error('[realtime] resync handler failed', error);
        }
      }
    };

    const connection = createRealtimeConnection({
      url,
      getToken: () => getTokenRef.current(),
      onStatus: setStatus,
      onEvent: dispatch,
      onResync: runResync,
      createSocket: (socketUrl) => new WebSocket(socketUrl),
      isVisible: () => document.visibilityState === 'visible',
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') connection.wake();
    };

    refreshAccessRef.current = connection.refreshAccess;
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', connection.wake);

    return () => {
      refreshAccessRef.current = () => {};
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', connection.wake);
      connection.dispose();
    };
  }, [clientId, url]);

  const value = useMemo<RealtimeSocketContextValue>(
    () => ({ clientId, subscribe, subscribeResync, refreshAccess }),
    [clientId, subscribe, subscribeResync, refreshAccess],
  );

  return (
    <RealtimeSocketContext.Provider value={value}>
      <RealtimeSocketStatusContext.Provider value={url ? status : 'closed'}>
        {children}
      </RealtimeSocketStatusContext.Provider>
    </RealtimeSocketContext.Provider>
  );
}

/** Connection status, in its own context: only components that read it re-render. */
export function useRealtimeSocketStatus(): RealtimeSocketStatus {
  return useContext(RealtimeSocketStatusContext);
}

export function useOptionalRealtimeSocket(): RealtimeSocketContextValue | null {
  return useContext(RealtimeSocketContext);
}

/**
 * Subscribes to realtime envelopes (filtered by domain/type). Own echoes are skipped.
 *
 * `coalesceMs`: a burst of events (an upload of N files, a bulk edit) calls
 * `onEvent` once, with the last envelope, after this much quiet. Only for
 * handlers that ignore the envelope details, such as a plain invalidation.
 */
export function useRealtimeSocketEvents(options: {
  enabled?: boolean;
  domains?: readonly string[];
  types?: readonly string[];
  coalesceMs?: number;
  onEvent: EventHandler;
}): void {
  const context = useContext(RealtimeSocketContext);
  const handlerRef = useRef(options.onEvent);
  const enabled = options.enabled ?? true;
  const coalesceMs = options.coalesceMs ?? 0;
  const domainsKey = options.domains?.join('\0') ?? '';
  const typesKey = options.types?.join('\0') ?? '';

  useEffect(() => {
    handlerRef.current = options.onEvent;
  }, [options.onEvent]);

  useEffect(() => {
    if (!context || !enabled) return;
    const forward: EventHandler = (envelope, topic) => handlerRef.current(envelope, topic);
    const coalesced = coalesceMs > 0 ? coalesce(forward, coalesceMs) : null;
    const unsubscribe = context.subscribe({
      domains: domainsKey ? domainsKey.split('\0') : undefined,
      types: typesKey ? typesKey.split('\0') : undefined,
      onEvent: coalesced ?? forward,
    });
    return () => {
      unsubscribe();
      coalesced?.cancel();
    };
  }, [context, enabled, coalesceMs, domainsKey, typesKey]);
}

type Coalesced = EventHandler & { cancel: () => void };

/** Trailing debounce: one call with the last arguments after `waitMs` without events. */
export function coalesce(handler: EventHandler, waitMs: number): Coalesced {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const coalesced = ((envelope: RealtimeEnvelope, topic: string) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      handler(envelope, topic);
    }, waitMs);
  }) as Coalesced;
  coalesced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return coalesced;
}

/** Called after every (re)connection: refetch everything the component shows. */
export function useRealtimeSocketResync(onResync: () => void, enabled = true): void {
  const context = useContext(RealtimeSocketContext);
  const handlerRef = useRef(onResync);

  useEffect(() => {
    handlerRef.current = onResync;
  }, [onResync]);

  useEffect(() => {
    if (!context || !enabled) return;
    return context.subscribeResync(() => handlerRef.current());
  }, [context, enabled]);
}
