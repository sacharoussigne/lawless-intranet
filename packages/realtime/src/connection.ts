import {
  REALTIME_CLOSE_CODE,
  type RealtimeClientMessage,
  type RealtimeServerMessage,
} from './protocol';
import type { RealtimeEnvelope } from './types';

/**
 * Connection loop of the browser realtime client, without React or DOM globals
 * (injected, so it can be tested):
 *
 * - One connection at a time: a reconnect request while a token is loading or a
 *   socket is open is ignored.
 * - The token is reused while it is valid, so a reconnection does not call the
 *   host (`getToken` is a server action or a route, both costly).
 * - No token (logged out, access removed) or a forbidden origin stops the loop
 *   until the next `wake()` (tab visible again, network back). A failed token
 *   request (host restarting) retries with backoff.
 * - Exponential backoff + jitter between attempts.
 * - Resyncs after a reconnection, delayed while the tab is hidden and spread
 *   over a few seconds so every client does not refetch at once after a deploy.
 * - Refreshes the token before it expires, and on demand (`refreshAccess`), on
 *   the same connection (no resync: nothing was missed).
 */

export type RealtimeSocketStatus = 'connecting' | 'open' | 'closed';

export type RealtimeSocketToken = { token: string; expiresAt: number };

/** The subset of the browser `WebSocket` used here. */
export type RealtimeSocketLike = {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'close', listener: (event: { code: number }) => void): void;
};

const SOCKET_OPEN = 1;

const PING_INTERVAL_MS = 25_000;
/**
 * No message (event or pong) for this long means the connection is dead. Only
 * checked while the tab is visible: hidden tabs throttle timers, so pings and
 * pongs may legitimately be a minute apart.
 */
export const STALE_CONNECTION_MS = 60_000;
export const TOKEN_REFRESH_MARGIN_MS = 60_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** Skip the very first resync when the socket opens right after the SSR render. */
const INITIAL_RESYNC_GRACE_MS = 5_000;
/** Resyncs are spread over this window (all clients reconnect together after a deploy). */
export const RESYNC_SPREAD_MS = 2_000;

/**
 * `ready` comes after every authentication: the first one of a connection, but
 * also each token refresh on the same connection. Only a new connection may
 * have missed events, so only its first `ready` resyncs (except the very first
 * connection right after the SSR render, whose data is fresh).
 */
export function shouldResyncOnReady(input: {
  firstOnSocket: boolean;
  firstConnection: boolean;
  sinceMountMs: number;
}): boolean {
  if (!input.firstOnSocket) return false;
  return !input.firstConnection || input.sinceMountMs > INITIAL_RESYNC_GRACE_MS;
}

export function computeReconnectDelay(attempt: number, random = Math.random): number {
  const exponential = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

/** A token can open a connection only if it stays valid past the refresh margin. */
export function isTokenUsable(token: RealtimeSocketToken | null, now: number): token is RealtimeSocketToken {
  return token !== null && token.expiresAt - now > TOKEN_REFRESH_MARGIN_MS;
}

export type RealtimeConnectionOptions = {
  url: string;
  getToken: () => Promise<RealtimeSocketToken | null>;
  onStatus: (status: RealtimeSocketStatus) => void;
  onEvent: (topic: string, envelope: RealtimeEnvelope) => void;
  onResync: () => void;
  createSocket: (url: string) => RealtimeSocketLike;
  isVisible: () => boolean;
  now?: () => number;
  random?: () => number;
};

export type RealtimeConnection = {
  /** Tab visible again or network back: reconnect now if disconnected. */
  wake: () => void;
  /** Access changed: fetch a new token and re-authenticate on the same socket. */
  refreshAccess: () => void;
  dispose: () => void;
};

export function createRealtimeConnection(options: RealtimeConnectionOptions): RealtimeConnection {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const mountedAt = now();

  let disposed = false;
  /** Set while waiting for a token, before the socket exists. */
  let connecting = false;
  /** Set when retrying cannot help (no token): only `wake()` restarts. */
  let stopped = false;
  let socket: RealtimeSocketLike | null = null;
  let token: RealtimeSocketToken | null = null;
  let attempt = 0;
  let connectedCount = 0;
  let readyOnCurrentSocket = false;
  let lastMessageAt = now();
  let resyncPending = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let tokenTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let resyncTimer: ReturnType<typeof setTimeout> | null = null;

  const send = (message: RealtimeClientMessage) => {
    if (socket?.readyState === SOCKET_OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const clearConnectionTimers = () => {
    if (tokenTimer) clearTimeout(tokenTimer);
    if (pingTimer) clearInterval(pingTimer);
    tokenTimer = null;
    pingTimer = null;
  };

  /** `null`: no access (stop); `'failed'`: the host did not answer (retry later). */
  const fetchToken = async (): Promise<RealtimeSocketToken | null | 'failed'> => {
    try {
      return await options.getToken();
    } catch (error) {
      console.warn('[realtime] failed to get token', error);
      return 'failed';
    }
  };

  const reauthenticate = async () => {
    const next = await fetchToken();
    if (disposed || !next || next === 'failed') return;
    token = next;
    send({ op: 'auth', token: next.token });
  };

  const scheduleTokenRefresh = (expiresAt: number) => {
    if (tokenTimer) clearTimeout(tokenTimer);
    const delay = Math.max(5_000, expiresAt - now() - TOKEN_REFRESH_MARGIN_MS);
    tokenTimer = setTimeout(() => {
      tokenTimer = null;
      void reauthenticate();
    }, delay);
  };

  const runResync = () => {
    resyncPending = false;
    if (resyncTimer) return;
    resyncTimer = setTimeout(() => {
      resyncTimer = null;
      if (!disposed) options.onResync();
    }, Math.round(random() * RESYNC_SPREAD_MS));
  };

  const requestResync = () => {
    if (options.isVisible()) {
      runResync();
    } else {
      // Hidden tabs refetch nothing; the resync runs when the tab is shown.
      resyncPending = true;
    }
  };

  /** A token is loading or a socket is connecting / open. */
  const isConnected = () => connecting || (socket !== null && socket.readyState <= SOCKET_OPEN);

  const scheduleReconnect = (immediate = false) => {
    if (disposed || stopped || reconnectTimer || isConnected()) return;
    const delay = immediate ? 0 : computeReconnectDelay(attempt, random);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const handleMessage = (raw: { data: unknown }) => {
    lastMessageAt = now();
    let message: RealtimeServerMessage;
    try {
      message = JSON.parse(String(raw.data)) as RealtimeServerMessage;
    } catch {
      return;
    }

    switch (message.op) {
      case 'ready': {
        attempt = 0;
        options.onStatus('open');
        scheduleTokenRefresh(message.expiresAt);
        const firstOnSocket = !readyOnCurrentSocket;
        readyOnCurrentSocket = true;
        if (firstOnSocket) connectedCount += 1;
        if (
          shouldResyncOnReady({
            firstOnSocket,
            firstConnection: connectedCount === 1,
            sinceMountMs: now() - mountedAt,
          })
        ) {
          requestResync();
        }
        break;
      }
      case 'event':
        options.onEvent(message.topic, message.envelope);
        break;
      case 'error':
        console.warn('[realtime] server error', message.code, message.message ?? '');
        break;
      default:
        break;
    }
  };

  async function connect() {
    if (disposed || isConnected()) return;
    connecting = true;
    options.onStatus('connecting');

    if (!isTokenUsable(token, now())) {
      const fetched = await fetchToken();
      connecting = false;
      if (disposed) return;
      if (fetched === 'failed') {
        options.onStatus('closed');
        scheduleReconnect();
        return;
      }
      token = fetched;
    }
    connecting = false;
    const connectToken = token;
    if (!isTokenUsable(connectToken, now())) {
      // Logged out or no access: retrying will not help until something changes.
      token = null;
      stopped = true;
      options.onStatus('closed');
      return;
    }

    let current: RealtimeSocketLike;
    try {
      current = options.createSocket(options.url);
    } catch (error) {
      console.warn('[realtime] failed to open websocket', error);
      options.onStatus('closed');
      scheduleReconnect();
      return;
    }
    socket = current;
    readyOnCurrentSocket = false;

    current.addEventListener('open', () => {
      lastMessageAt = now();
      current.send(JSON.stringify({ op: 'auth', token: connectToken.token } satisfies RealtimeClientMessage));
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (options.isVisible() && now() - lastMessageAt > STALE_CONNECTION_MS) {
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
      clearConnectionTimers();
      if (disposed) return;
      options.onStatus('closed');
      if (event.code === REALTIME_CLOSE_CODE.forbiddenOrigin) {
        stopped = true;
        return;
      }
      const tokenRejected =
        event.code === REALTIME_CLOSE_CODE.tokenExpired || event.code === REALTIME_CLOSE_CODE.unauthorized;
      if (tokenRejected) token = null;
      // An expired token recovers at once with a fresh one; anything else backs off.
      scheduleReconnect(event.code === REALTIME_CLOSE_CODE.tokenExpired);
    });
  }

  const wake = () => {
    if (disposed) return;
    if (resyncPending && options.isVisible()) runResync();
    if (socket?.readyState === SOCKET_OPEN && options.isVisible() && now() - lastMessageAt > STALE_CONNECTION_MS) {
      // Probably died while the tab was hidden: its close handler reconnects.
      socket.close();
      return;
    }
    if (isConnected()) return;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopped = false;
    attempt = 0;
    scheduleReconnect(true);
  };

  void connect();

  return {
    wake,
    refreshAccess: () => {
      void reauthenticate();
    },
    dispose: () => {
      disposed = true;
      clearConnectionTimers();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (resyncTimer) clearTimeout(resyncTimer);
      reconnectTimer = null;
      resyncTimer = null;
      socket?.close();
      socket = null;
    },
  };
}
