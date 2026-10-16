import { getAuthUrl } from './config';

/** Internal calls must not hang a request (or a bot action) when the auth service is slow. */
const INTERNAL_TIMEOUT_MS = 5_000;

/** The auth service did not answer properly: callers can tell "unknown" from "no account". */
export class AuthInternalError extends Error {}

async function postInternal<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getAuthUrl()}${path}`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new AuthInternalError(`Auth internal ${path} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

function getInternalHeaders(): Record<string, string> {
  const secret = process.env.AUTH_INTERNAL_SECRET;
  if (!secret) {
    throw new Error('AUTH_INTERNAL_SECRET is not configured');
  }

  return {
    'Content-Type': 'application/json',
    'x-auth-internal-secret': secret,
  };
}

/** Accounts holding these Discord ids. Throws `AuthInternalError` (or a network error) when auth fails. */
export async function resolveUsersByDiscordIds(
  discordIds: string[],
): Promise<Array<{ discordId: string; userId: string; name: string }>> {
  if (discordIds.length === 0) {
    return [];
  }
  return postInternal('/api/internal/users/by-discord', { discordIds });
}

/** Discord id of each account (accounts without Discord are missing). Throws when auth fails. */
export async function resolveDiscordIdsForUserIds(
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const rows = await postInternal<Array<{ userId: string; discordId: string }>>(
    '/api/internal/users/discord-for-users',
    { userIds },
  );
  return new Map(rows.map((row) => [row.userId, row.discordId]));
}
