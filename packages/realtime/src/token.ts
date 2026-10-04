import { createHmac, timingSafeEqual } from 'node:crypto';
import { isValidRealtimeTopic } from './topics';

/**
 * Short-lived realtime subscription tokens (server-only).
 *
 * Host apps (dispensary, shelter) know the user's permissions: they sign the
 * list of allowed topics; the websocket server only verifies the signature.
 * Format: `v1.<base64url(json payload)>.<base64url(hmac-sha256)>`.
 */
export type RealtimeTokenPayload = {
  /** User id. */
  sub: string;
  topics: string[];
  /** Expiry, epoch milliseconds. */
  exp: number;
};

export const REALTIME_TOKEN_DEFAULT_TTL_MS = 10 * 60 * 1000;

const VERSION = 'v1';

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signRealtimeToken(
  input: { userId: string; topics: string[]; ttlMs?: number; now?: number },
  secret: string,
): { token: string; expiresAt: number } {
  if (!secret) {
    throw new Error('Realtime token secret is not configured');
  }
  const exp = (input.now ?? Date.now()) + (input.ttlMs ?? REALTIME_TOKEN_DEFAULT_TTL_MS);
  const topics = [...new Set(input.topics)].filter(isValidRealtimeTopic);
  const payload: RealtimeTokenPayload = { sub: input.userId, topics, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${VERSION}.${encoded}`;
  return { token: `${data}.${sign(data, secret)}`, expiresAt: exp };
}

export type RealtimeTokenVerification =
  | { ok: true; payload: RealtimeTokenPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyRealtimeToken(
  token: string,
  secret: string,
  now = Date.now(),
): RealtimeTokenVerification {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3 || parts[0] !== VERSION || !secret) {
    return { ok: false, reason: 'malformed' };
  }

  const data = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!isTokenPayload(payload)) {
    return { ok: false, reason: 'malformed' };
  }
  if (payload.exp <= now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}

function isTokenPayload(value: unknown): value is RealtimeTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sub === 'string' &&
    candidate.sub.length > 0 &&
    typeof candidate.exp === 'number' &&
    Array.isArray(candidate.topics) &&
    candidate.topics.every(isValidRealtimeTopic)
  );
}
