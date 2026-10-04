import type { RealtimeEnvelope } from './types';

/**
 * Websocket protocol between the browser and the realtime server (JSON text frames).
 *
 * The client authenticates with a short-lived token signed by its host app
 * (see `./token`). The token lists the topics the user may receive; sending a
 * new `auth` message replaces the topic set (used after access changes).
 */
export type RealtimeClientMessage =
  | { op: 'auth'; token: string }
  | { op: 'ping' };

export type RealtimeServerMessage =
  | { op: 'ready'; topics: string[]; expiresAt: number }
  | { op: 'event'; topic: string; envelope: RealtimeEnvelope }
  | { op: 'error'; code: RealtimeErrorCode; message?: string }
  | { op: 'pong' };

export type RealtimeErrorCode = 'invalid_message' | 'invalid_token' | 'auth_timeout';

/** Close codes (4000-4999 are reserved for applications). */
export const REALTIME_CLOSE_CODE = {
  /** Token rejected or missing: the client must fetch a new token before reconnecting. */
  unauthorized: 4001,
  /** Token expired: the client reconnects with a fresh token. */
  tokenExpired: 4002,
  /** Origin not allowed. */
  forbiddenOrigin: 4003,
} as const;

/** Body of `POST /publish` on the realtime server internal port. */
export type RealtimePublishRequest = {
  topics: string[];
  envelope: RealtimeEnvelope;
};

/** Body of `POST /revoke` on the realtime server internal port. */
export type RealtimeRevokeRequest = {
  userId: string;
  topics: string[];
};

export const REALTIME_INTERNAL_SECRET_HEADER = 'x-realtime-internal-secret';
