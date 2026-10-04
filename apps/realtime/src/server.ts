import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import {
  isValidRealtimeTopic,
  REALTIME_CLOSE_CODE,
  REALTIME_INTERNAL_SECRET_HEADER,
  type RealtimeServerMessage,
} from '@lawless-intranet/realtime';
import { verifyRealtimeToken } from '@lawless-intranet/realtime/token';
import type { RealtimeServerConfig } from './config';
import { RealtimeHub, type HubConnection } from './hub';

const AUTH_TIMEOUT_MS = 10_000;
/** Below nginx-proxy's default 60s proxy_read_timeout. */
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_CLIENT_MESSAGE_BYTES = 16 * 1024;
const MAX_INTERNAL_BODY_BYTES = 64 * 1024;

const topicSchema = z.string().refine(isValidRealtimeTopic, 'Invalid topic');

const publishSchema = z.object({
  topics: z.array(topicSchema).min(1).max(500),
  envelope: z.object({
    domain: z.string().min(1).max(64),
    type: z.string().min(1).max(64),
    originClientId: z.string().max(128).optional(),
    payload: z.unknown(),
  }),
});

const revokeSchema = z.object({
  userId: z.string().min(1).max(128),
  topics: z.array(topicSchema).min(1).max(500),
});

const clientMessageSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('auth'), token: z.string().min(1).max(8192) }),
  z.object({ op: z.literal('ping') }),
]);

type LiveConnection = HubConnection & {
  socket: WebSocket;
  alive: boolean;
  authenticated: boolean;
  authTimer: NodeJS.Timeout | null;
  expiryTimer: NodeJS.Timeout | null;
};

export type RealtimeServer = {
  hub: RealtimeHub;
  start: () => Promise<{ wsPort: number; internalPort: number }>;
  stop: () => Promise<void>;
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function secretMatches(provided: string | string[] | undefined, expected: string): boolean {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_INTERNAL_BODY_BYTES) {
      throw new Error('Body too large');
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections?.();
  });
}

export function createRealtimeServer(config: RealtimeServerConfig): RealtimeServer {
  const hub = new RealtimeHub();
  const connections = new Set<LiveConnection>();
  const allowedOrigins = new Set(config.allowedOrigins);

  // --- Internal HTTP API (docker network only) ---
  const internalServer = createServer((request, response) => {
    void handleInternal(request, response);
  });

  async function handleInternal(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? '/', 'http://internal');

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, ...hub.stats() });
      return;
    }

    if (request.method !== 'POST' || (url.pathname !== '/publish' && url.pathname !== '/revoke')) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    if (!secretMatches(request.headers[REALTIME_INTERNAL_SECRET_HEADER], config.internalSecret)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      sendJson(response, 400, { error: 'Invalid JSON body' });
      return;
    }

    if (url.pathname === '/publish') {
      const parsed = publishSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(response, 400, { error: parsed.error.issues[0]?.message ?? 'Invalid body' });
        return;
      }
      const delivered = hub.publish(parsed.data.topics, parsed.data.envelope);
      sendJson(response, 200, { delivered });
      return;
    }

    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      sendJson(response, 400, { error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      return;
    }
    const affected = hub.revoke(parsed.data.userId, parsed.data.topics);
    sendJson(response, 200, { affected });
  }

  // --- Public websocket server (behind nginx-proxy) ---
  const wsHttpServer = createServer((request, response) => {
    if (request.method === 'GET' && (request.url === '/health' || request.url === '/')) {
      sendJson(response, 200, { ok: true });
      return;
    }
    sendJson(response, 426, { error: 'Upgrade required' });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_CLIENT_MESSAGE_BYTES });

  function isOriginAllowed(origin: string | undefined): boolean {
    if (allowedOrigins.size === 0) return true;
    return Boolean(origin && allowedOrigins.has(origin.replace(/\/$/, '')));
  }

  wsHttpServer.on('upgrade', (request, socket, head) => {
    if (!isOriginAllowed(request.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  function send(connection: LiveConnection, message: RealtimeServerMessage): void {
    if (connection.socket.readyState === connection.socket.OPEN) {
      connection.socket.send(JSON.stringify(message));
    }
  }

  function closeConnection(connection: LiveConnection, code: number, reason: string): void {
    connection.socket.close(code, reason);
  }

  function authenticate(connection: LiveConnection, token: string): void {
    const result = verifyRealtimeToken(token, config.tokenSecret);
    if (!result.ok) {
      send(connection, { op: 'error', code: 'invalid_token', message: result.reason });
      closeConnection(
        connection,
        result.reason === 'expired' ? REALTIME_CLOSE_CODE.tokenExpired : REALTIME_CLOSE_CODE.unauthorized,
        result.reason,
      );
      return;
    }

    const { sub, topics, exp } = result.payload;
    if (connection.authenticated && connection.userId !== sub) {
      // A connection is bound to one user for its whole life.
      closeConnection(connection, REALTIME_CLOSE_CODE.unauthorized, 'user mismatch');
      return;
    }

    if (connection.authTimer) clearTimeout(connection.authTimer);
    connection.authTimer = null;
    connection.userId = sub;
    connection.authenticated = true;
    hub.setTopics(connection, topics);

    if (connection.expiryTimer) clearTimeout(connection.expiryTimer);
    connection.expiryTimer = setTimeout(() => {
      closeConnection(connection, REALTIME_CLOSE_CODE.tokenExpired, 'token expired');
    }, Math.max(0, exp - Date.now()));

    send(connection, { op: 'ready', topics: [...connection.topics], expiresAt: exp });
  }

  wss.on('connection', (socket: WebSocket) => {
    const connection: LiveConnection = {
      id: randomUUID(),
      userId: '',
      topics: new Set(),
      socket,
      alive: true,
      authenticated: false,
      authTimer: null,
      expiryTimer: null,
      deliver: (topic, envelope) => send(connection, { op: 'event', topic, envelope }),
    };
    connections.add(connection);

    connection.authTimer = setTimeout(() => {
      send(connection, { op: 'error', code: 'auth_timeout' });
      closeConnection(connection, REALTIME_CLOSE_CODE.unauthorized, 'auth timeout');
    }, AUTH_TIMEOUT_MS);

    socket.on('pong', () => {
      connection.alive = true;
    });

    socket.on('message', (data, isBinary) => {
      connection.alive = true;
      if (isBinary) {
        send(connection, { op: 'error', code: 'invalid_message' });
        return;
      }
      let parsed: z.infer<typeof clientMessageSchema>;
      try {
        const result = clientMessageSchema.safeParse(JSON.parse(data.toString()));
        if (!result.success) {
          send(connection, { op: 'error', code: 'invalid_message' });
          return;
        }
        parsed = result.data;
      } catch {
        send(connection, { op: 'error', code: 'invalid_message' });
        return;
      }

      if (parsed.op === 'ping') {
        send(connection, { op: 'pong' });
        return;
      }
      authenticate(connection, parsed.token);
    });

    socket.on('close', () => {
      if (connection.authTimer) clearTimeout(connection.authTimer);
      if (connection.expiryTimer) clearTimeout(connection.expiryTimer);
      connections.delete(connection);
      if (connection.authenticated) {
        hub.remove(connection);
      }
    });

    socket.on('error', (error) => {
      console.warn('[realtime] socket error', error.message);
    });
  });

  let heartbeat: NodeJS.Timeout | null = null;

  return {
    hub,
    async start() {
      const wsPort = await listen(wsHttpServer, config.wsPort, config.host);
      const internalPort = await listen(internalServer, config.internalPort, config.host);
      heartbeat = setInterval(() => {
        for (const connection of connections) {
          if (!connection.alive) {
            connection.socket.terminate();
            continue;
          }
          connection.alive = false;
          connection.socket.ping();
        }
      }, HEARTBEAT_INTERVAL_MS);
      return { wsPort, internalPort };
    },
    async stop() {
      if (heartbeat) clearInterval(heartbeat);
      for (const connection of connections) {
        connection.socket.close(1001, 'server shutting down');
      }
      wss.close();
      await Promise.all([close(wsHttpServer), close(internalServer)]);
    },
  };
}
