import { getAuthUrl } from './config';

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

export async function resolveUsersByDiscordIds(
  discordIds: string[],
): Promise<Array<{ discordId: string; userId: string; name: string }>> {
  if (discordIds.length === 0) {
    return [];
  }

  const response = await fetch(`${getAuthUrl()}/api/internal/users/by-discord`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify({ discordIds }),
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export async function resolveDiscordIdsForUserIds(
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const response = await fetch(`${getAuthUrl()}/api/internal/users/discord-for-users`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify({ userIds }),
    cache: 'no-store',
  });

  if (!response.ok) {
    return new Map();
  }

  const rows = (await response.json()) as Array<{ userId: string; discordId: string }>;
  return new Map(rows.map((row) => [row.userId, row.discordId]));
}

export async function findUserIdByDiscordId(discordUserId: string): Promise<string | null> {
  const rows = await resolveUsersByDiscordIds([discordUserId]);
  return rows[0]?.userId ?? null;
}

export async function findDiscordIdByUserId(userId: string): Promise<string | null> {
  const map = await resolveDiscordIdsForUserIds([userId]);
  return map.get(userId) ?? null;
}
