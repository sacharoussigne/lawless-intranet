import { findDiscordIdByUserId } from '@lawless-intranet/auth-client/internal';

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { discordId: string | null; expiresAt: number }>();

/**
 * Discord id of an intranet account, for the logs of its actions: a search by
 * Discord id then also finds what the person did on the intranet. Cached a few
 * minutes (one lookup per user, not per log line). Null for an account without
 * Discord or when the auth service does not answer.
 */
export async function discordIdForLog(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now) return hit.discordId;
  try {
    const discordId = await findDiscordIdByUserId(userId);
    cache.set(userId, { discordId, expiresAt: now + TTL_MS });
    return discordId;
  } catch {
    return null;
  }
}
