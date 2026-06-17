import type { AuthSession, AuthUserPublic } from '@lawless-intranet/types';
import { authFetch } from './config';

export async function getSession(
  cookieHeader?: string | null,
): Promise<AuthSession | null> {
  const response = await authFetch('/api/session', {
    cookieHeader,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<AuthSession>;
}

export async function getUser(
  id: string,
  cookieHeader?: string | null,
): Promise<AuthUserPublic | null> {
  const response = await authFetch(`/api/users/${encodeURIComponent(id)}`, {
    cookieHeader,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<AuthUserPublic>;
}

export async function searchUsers(
  query: string,
  cookieHeader?: string | null,
): Promise<AuthUserPublic[]> {
  const response = await authFetch(
    `/api/users/search?q=${encodeURIComponent(query)}`,
    { cookieHeader },
  );

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<AuthUserPublic[]>;
}

export async function batchGetUsers(
  ids: string[],
  cookieHeader?: string | null,
): Promise<AuthUserPublic[]> {
  if (ids.length === 0) {
    return [];
  }

  const response = await authFetch('/api/users/batch', {
    method: 'POST',
    cookieHeader,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<AuthUserPublic[]>;
}

export async function listDiscordUsers(
  cookieHeader?: string | null,
): Promise<AuthUserPublic[]> {
  const response = await authFetch('/api/users/batch?discordOnly=true', {
    cookieHeader,
  });

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<AuthUserPublic[]>;
}

export async function listAllUsers(
  cookieHeader?: string | null,
): Promise<AuthUserPublic[]> {
  const response = await authFetch('/api/users', { cookieHeader });

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<AuthUserPublic[]>;
}

export function buildUsersMap(users: AuthUserPublic[]): Map<string, AuthUserPublic> {
  return new Map(users.map((user) => [user.id, user]));
}
