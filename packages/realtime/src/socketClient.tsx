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
  REALTIME_CLOSE_CODE,
  type RealtimeClientMessage,
  type RealtimeServerMessage,
} from './protocol';
import type { RealtimeEnvelope } from './types';

/**
 * Browser websocket client for the realtime server.
 *
 * - Fetches a signed token from the host app (`getToken`, usually a server action)
 *   and authenticates with it after each connection.
 * - Reconnects with exponential backoff + jitter, immediately when the tab
 *   becomes visible again or the network comes back.
 * - Calls `resync` handlers after every (re)connection: consumers refetch their
 *   data, so notifications missed while disconnected are never lost.
 * - Refreshes the token before it expires, and on demand (`refreshAccess`)
 *   after an access change.
 */

export type RealtimeSocketStatus = 'connecting' | 'open' | 'closed';

export type RealtimeSocketToken = { token: string; expiresAt: number };

type EventHandler = (envelope: RealtimeEnvelope, topic: string) => void;

type Subscription = {
  domains?: readonly string[];
  types?: readonly string[];
  onEvent: EventHandler;
};

type RealtimeSocketContextValue = {
  clientId: string;
  status: RealtimeSocketStatus;
  subscribe: (subscription: Subscription) => () => void;
  subscribeResync: (handler: () => void) => () => void;
  refreshAccess: () => void;
};

const RealtimeSocketContext = createContext<RealtimeSocketContextValue | null>(null);

const PING_INTERVAL_MS = 25_000;
/** No message (event or pong) for this long means the connection is dead. */
const STALE_CONNECTION_MS = 60_000;
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** Skip the very first resync when the socket opens right after the SSR render. */
const INITIAL_RESYNC_GRACE_MS = 5_000;

export function computeReconnectDelay(attempt: number, random = Math.random): number {
  const exponential = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

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

    const mountedAt = Date.now();
    let disposed = false;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let readyCount = 0;
    let lastMessageAt = Date.now();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let tokenTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const send = (message: RealtimeClientMessage) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const clearTimers = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (tokenTimer) clearTimeout(tokenTimer);
      if (pingTimer) clearInterval(pingTimer);
      reconnectTimer = null;
      tokenTimer = null;
      pingTimer = null;
    };

    const fetchToken = async (): Promise<RealtimeSocketToken | null> => {
      try {
        return await getTokenRef.current();
      } catch (error) {
        console.warn('[realtime] failed to get token', error);
        return null;
      }
    };

    const scheduleTokenRefresh = (expiresAt: number) => {
      if (tokenTimer) clearTimeout(tokenTimer);
      const delay = Math.max(5_000, expiresAt - Date.now() - TOKEN_REFRESH_MARGIN_MS);
      tokenTimer = setTimeout(() => {
        void reauthenticate();
      }, delay);
    };

    const reauthenticate = async () => {
      const next = await fetchToken();
      if (disposed || !next) return;
      send({ op: 'auth', token: next.token });
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

    const scheduleReconnect = (immediate = false) => {
      if (disposed || reconnectTimer) return;
      const delay = immediate ? 0 : computeReconnectDelay(attempt);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const handleMessage = (raw: MessageEvent) => {
      lastMessageAt = Date.now();
      let message: RealtimeServerMessage;
      try {
        message = JSON.parse(String(raw.data)) as RealtimeServerMessage;
      } catch {
        return;
      }

      switch (message.op) {
        case 'ready': {
          attempt = 0;
          readyCount += 1;
          setStatus('open');
          scheduleTokenRefresh(message.expiresAt);
          const isFirstReady = readyCount === 1;
          if (!isFirstReady || Date.now() - mountedAt > INITIAL_RESYNC_GRACE_MS) {
            runResync();
          }
          break;
        }
        case 'event':
          dispatch(message.topic, message.envelope);
          break;
        case 'error':
          console.warn('[realtime] server error', message.code, message.message ?? '');
          break;
        default:
          break;
      }
    };

    async function connect() {
      if (disposed) return;
      setStatus('connecting');

      const token = await fetchToken();
      if (disposed) return;
      if (!token) {
        setStatus('closed');
        scheduleReconnect();
        return;
      }

      let current: WebSocket;
      try {
        current = new WebSocket(url);
      } catch (error) {
        console.warn('[realtime] failed to open websocket', error);
        setStatus('closed');
        scheduleReconnect();
        return;
      }
      socket = current;

      current.addEventListener('open', () => {
        lastMessageAt = Date.now();
        current.send(JSON.stringify({ op: 'auth', token: token.token } satisfies RealtimeClientMessage));
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (Date.now() - lastMessageAt > STALE_CONNECTION_MS) {
            current.close();
            return;
          }
          send({ op: 'ping' });
        }, PING_INTERVAL_MS);
      });

      current.addEventListener('message', handleMessage);

      current.addEventListener('close', (event) => {
        if (socket !== current) return;
        socket = null;
        clearTimers();
        if (disposed) return;
        setStatus('closed');
        // Token problems recover with a fresh token on the next attempt.
        const immediate = event.code === REALTIME_CLOSE_CODE.tokenExpired;
        scheduleReconnect(immediate);
      });
    }

    const reconnectNow = () => {
      if (disposed) return;
      if (socket && socket.readyState <= WebSocket.OPEN) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      attempt = 0;
      scheduleReconnect(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconnectNow();
    };

    refreshAccessRef.current = () => {
      void reauthenticate();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', reconnectNow);
    void connect();

    return () => {
      disposed = true;
      refreshAccessRef.current = () => {};
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', reconnectNow);
      clearTimers();
      socket?.close();
      socket = null;
    };
  }, [clientId, url]);

  const value = useMemo<RealtimeSocketContextValue>(
    () => ({ clientId, status: url ? status : 'closed', subscribe, subscribeResync, refreshAccess }),
    [clientId, status, url, subscribe, subscribeResync, refreshAccess],
  );

  return (
    <RealtimeSocketContext.Provider value={value}>{children}</RealtimeSocketContext.Provider>
  );
}

export function useOptionalRealtimeSocket(): RealtimeSocketContextValue | null {
  return useContext(RealtimeSocketContext);
}

/** Subscribes to realtime envelopes (filtered by domain/type). Own echoes are skipped. */
export function useRealtimeSocketEvents(options: {
  enabled?: boolean;
  domains?: readonly string[];
  types?: readonly string[];
  onEvent: EventHandler;
}): void {
  const context = useContext(RealtimeSocketContext);
  const handlerRef = useRef(options.onEvent);
  const enabled = options.enabled ?? true;
  const domainsKey = options.domains?.join('\0') ?? '';
  const typesKey = options.types?.join('\0') ?? '';

  useEffect(() => {
    handlerRef.current = options.onEvent;
  }, [options.onEvent]);

  useEffect(() => {
    if (!context || !enabled) return;
    return context.subscribe({
      domains: domainsKey ? domainsKey.split('\0') : undefined,
      types: typesKey ? typesKey.split('\0') : undefined,
      onEvent: (envelope, topic) => handlerRef.current(envelope, topic),
    });
  }, [context, enabled, domainsKey, typesKey]);
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
