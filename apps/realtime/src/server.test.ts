import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  REALTIME_CLOSE_CODE,
  REALTIME_INTERNAL_SECRET_HEADER,
  type RealtimeServerMessage,
} from '@lawless-intranet/realtime';
import { signRealtimeToken } from '@lawless-intranet/realtime/token';
import { createRealtimeServer, type RealtimeServer } from './server';

const TOKEN_SECRET = 'token-secret-for-tests';
const INTERNAL_SECRET = 'internal-secret-for-tests';
const ORIGIN = 'http://dispensary.localhost:3000';

let server: RealtimeServer;
let wsPort: number;
let internalPort: number;

beforeEach(async () => {
  server = createRealtimeServer({
    host: '127.0.0.1',
    wsPort: 0,
    internalPort: 0,
    allowedOrigins: [ORIGIN],
    tokenSecret: TOKEN_SECRET,
    internalSecret: INTERNAL_SECRET,
    production: false,
  });
  ({ wsPort, internalPort } = await server.start());
});

afterEach(async () => {
  await server.stop();
});

type TestClient = {
  socket: WebSocket;
  next: () => Promise<RealtimeServerMessage>;
  closed: Promise<number>;
};

function connect(origin = ORIGIN): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${wsPort}`, { origin });
    const queue: RealtimeServerMessage[] = [];
    const waiters: Array<(message: RealtimeServerMessage) => void> = [];
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as RealtimeServerMessage;
      const waiter = waiters.shift();
      if (waiter) waiter(message);
      else queue.push(message);
    });
    const closed = new Promise<number>((resolveClose) => socket.on('close', (code) => resolveClose(code)));
    socket.on('open', () =>
      resolve({
        socket,
        closed,
        next: () =>
          new Promise((resolveMessage) => {
            const queued = queue.shift();
            if (queued) resolveMessage(queued);
            else waiters.push(resolveMessage);
          }),
      }),
    );
    socket.on('error', reject);
  });
}

function token(userId: string, topics: string[]) {
  return signRealtimeToken({ userId, topics }, TOKEN_SECRET).token;
}

async function post(path: string, body: unknown, secret = INTERNAL_SECRET) {
  return fetch(`http://127.0.0.1:${internalPort}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [REALTIME_INTERNAL_SECRET_HEADER]: secret },
    body: JSON.stringify(body),
  });
}

const envelope = { domain: 'agenda', type: 'todos', payload: { agendaId: 'a1' } };

describe('realtime server', () => {
  it('authenticates, then delivers published events on allowed topics', async () => {
    const client = await connect();
    client.socket.send(JSON.stringify({ op: 'auth', token: token('u1', ['agenda:a1', 'user:u1']) }));
    const ready = await client.next();
    expect(ready).toMatchObject({ op: 'ready', topics: ['agenda:a1', 'user:u1'] });

    const response = await post('/publish', { topics: ['agenda:a1'], envelope });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ delivered: 1 });
    expect(await client.next()).toEqual({ op: 'event', topic: 'agenda:a1', envelope });

    client.socket.close();
  });

  it('does not deliver topics outside the token', async () => {
    const client = await connect();
    client.socket.send(JSON.stringify({ op: 'auth', token: token('u1', ['agenda:a1']) }));
    await client.next();

    const response = await post('/publish', { topics: ['agenda:other'], envelope });
    expect(await response.json()).toEqual({ delivered: 0 });
    client.socket.close();
  });

  it('closes the connection on an invalid token', async () => {
    const client = await connect();
    client.socket.send(JSON.stringify({ op: 'auth', token: 'v1.bad.token' }));
    expect(await client.next()).toMatchObject({ op: 'error', code: 'invalid_token' });
    expect(await client.closed).toBe(REALTIME_CLOSE_CODE.unauthorized);
  });

  it('rejects disallowed origins before the upgrade', async () => {
    await expect(connect('https://evil.example')).rejects.toThrow();
  });

  it('rejects internal calls without the secret', async () => {
    const response = await post('/publish', { topics: ['agenda:a1'], envelope }, 'wrong-secret-value');
    expect(response.status).toBe(401);
  });

  it('revokes topics for a user', async () => {
    const client = await connect();
    client.socket.send(JSON.stringify({ op: 'auth', token: token('u1', ['agenda:a1']) }));
    await client.next();

    await post('/revoke', { userId: 'u1', topics: ['agenda:a1'] });
    const response = await post('/publish', { topics: ['agenda:a1'], envelope });
    expect(await response.json()).toEqual({ delivered: 0 });
    client.socket.close();
  });

  it('answers application pings', async () => {
    const client = await connect();
    client.socket.send(JSON.stringify({ op: 'ping' }));
    expect(await client.next()).toEqual({ op: 'pong' });
    client.socket.close();
  });
});
