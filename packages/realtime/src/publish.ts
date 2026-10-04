import {
  REALTIME_INTERNAL_SECRET_HEADER,
  type RealtimePublishRequest,
  type RealtimeRevokeRequest,
} from './protocol';
import type { RealtimeEnvelope } from './types';

/**
 * Server-side helpers for services publishing to the realtime server
 * (internal port, docker network only).
 *
 * They never throw: a committed write must not fail because realtime is down.
 * Clients resync on reconnect, so a lost notification is only a delay.
 */
type PublishOptions = {
  /** Defaults to REALTIME_INTERNAL_URL. */
  baseUrl?: string;
  /** Defaults to REALTIME_INTERNAL_SECRET. */
  secret?: string;
  timeoutMs?: number;
  logLabel?: string;
};

const DEFAULT_TIMEOUT_MS = 2000;

async function postInternal(
  path: string,
  body: unknown,
  options: PublishOptions,
): Promise<boolean> {
  const baseUrl = options.baseUrl ?? process.env.REALTIME_INTERNAL_URL;
  const secret = options.secret ?? process.env.REALTIME_INTERNAL_SECRET;
  const label = options.logLabel ?? 'realtime';

  if (!baseUrl || !secret) {
    return false;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [REALTIME_INTERNAL_SECRET_HEADER]: secret,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[${label}] ${path} failed with status ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[${label}] ${path} failed`, error);
    return false;
  }
}

export async function publishRealtime(
  topics: string[],
  envelope: RealtimeEnvelope,
  options: PublishOptions = {},
): Promise<boolean> {
  const uniqueTopics = [...new Set(topics)];
  if (uniqueTopics.length === 0) return true;
  const body: RealtimePublishRequest = { topics: uniqueTopics, envelope };
  return postInternal('/publish', body, options);
}

/** Drops topics from every live connection of a user (access revoked). */
export async function revokeRealtimeTopics(
  userId: string,
  topics: string[],
  options: PublishOptions = {},
): Promise<boolean> {
  if (topics.length === 0) return true;
  const body: RealtimeRevokeRequest = { userId, topics };
  return postInternal('/revoke', body, options);
}
