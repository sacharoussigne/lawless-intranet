import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRealtimeConnection,
  isTokenUsable,
  STALE_CONNECTION_MS,
  TOKEN_REFRESH_MARGIN_MS,
  type RealtimeSocketToken,
} from './connection';
import { REALTIME_CLOSE_CODE } from './protocol';

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, Array<(event: never) => void>>();

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close', { code });
  }

  addEventListener(type: string, listener: (event: never) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, event?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event as never);
  }

  open() {
    this.readyState = 1;
    this.emit('open');
  }

  ready(expiresAt: number) {
    this.emit('message', { data: JSON.stringify({ op: 'ready', topics: [], expiresAt }) });
  }
}

const TTL_MS = 30 * 60_000;

function setup(options: { getToken?: () => Promise<RealtimeSocketToken | null>; visible?: boolean } = {}) {
  const sockets: FakeSocket[] = [];
  let visible = options.visible ?? true;
  const getToken = vi.fn(
    options.getToken ?? (async () => ({ token: 't', expiresAt: Date.now() + TTL_MS })),
  );
  const onResync = vi.fn();
  const onStatus = vi.fn();
  const connection = createRealtimeConnection({
    url: 'ws://test',
    getToken,
    onStatus,
    onEvent: vi.fn(),
    onResync,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    isVisible: () => visible,
    random: () => 0,
  });
  return {
    connection,
    sockets,
    getToken,
    onResync,
    onStatus,
    setVisible: (value: boolean) => {
      visible = value;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('isTokenUsable', () => {
  it('rejects a missing token or one about to expire', () => {
    expect(isTokenUsable(null, 0)).toBe(false);
    expect(isTokenUsable({ token: 't', expiresAt: TOKEN_REFRESH_MARGIN_MS }, 0)).toBe(false);
    expect(isTokenUsable({ token: 't', expiresAt: TOKEN_REFRESH_MARGIN_MS + 1 }, 0)).toBe(true);
  });
});

describe('createRealtimeConnection', () => {
  it('opens a single socket when woken while the token is loading', async () => {
    let resolveToken: (token: RealtimeSocketToken) => void = () => {};
    const { connection, sockets, getToken } = setup({
      getToken: () =>
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
    });

    connection.wake();
    connection.wake();
    await vi.runAllTimersAsync();
    resolveToken({ token: 't', expiresAt: Date.now() + TTL_MS });
    await vi.runAllTimersAsync();

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(1);
    connection.dispose();
  });

  it('reuses a valid token when reconnecting', async () => {
    const { connection, sockets, getToken } = setup();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].open();
    sockets[0].close(1006);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(sockets).toHaveLength(2);
    expect(getToken).toHaveBeenCalledTimes(1);
    connection.dispose();
  });

  it('fetches a new token after the server rejects one', async () => {
    const { connection, sockets, getToken } = setup();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].open();
    sockets[0].close(REALTIME_CLOSE_CODE.unauthorized);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(sockets).toHaveLength(2);
    connection.dispose();
  });

  it('stops retrying without a token until woken', async () => {
    const { connection, sockets, getToken, onStatus } = setup({ getToken: async () => null });
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(0);
    expect(onStatus).toHaveBeenLastCalledWith('closed');

    connection.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(getToken).toHaveBeenCalledTimes(2);
    connection.dispose();
  });

  it('retries with backoff when the token request fails', async () => {
    let calls = 0;
    const { connection, sockets } = setup({
      getToken: async () => {
        calls += 1;
        if (calls === 1) throw new Error('host restarting');
        return { token: 't', expiresAt: Date.now() + TTL_MS };
      },
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(calls).toBe(2);
    expect(sockets).toHaveLength(1);
    connection.dispose();
  });

  it('keeps a quiet socket open while the tab is hidden', async () => {
    const { connection, sockets, setVisible } = setup({ visible: false });
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].open();
    await vi.advanceTimersByTimeAsync(STALE_CONNECTION_MS * 3);
    expect(sockets[0].readyState).toBe(1);

    // Back to the foreground: a stale socket is replaced at once.
    setVisible(true);
    connection.wake();
    expect(sockets[0].readyState).toBe(3);
    connection.dispose();
  });

  it('delays the resync of a hidden tab until it is visible', async () => {
    const { connection, sockets, onResync, setVisible } = setup({ visible: false });
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].open();
    sockets[0].ready(Date.now() + TTL_MS);
    sockets[0].close(1006);
    await vi.advanceTimersByTimeAsync(1_000);
    sockets[1].open();
    sockets[1].ready(Date.now() + TTL_MS);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onResync).not.toHaveBeenCalled();

    setVisible(true);
    connection.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(onResync).toHaveBeenCalledTimes(1);
    connection.dispose();
  });
});
