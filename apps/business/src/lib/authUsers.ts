import { headers } from 'next/headers';
import {
  batchGetUsers,
  buildUsersMap,
  getUser,
  listAllUsers,
  listDiscordUsers,
  searchUsers,
} from '@lawless-intranet/auth-client/server';
import type { AuthUserPublic } from '@lawless-intranet/types';

export async function getCookieHeader(): Promise<string | null> {
  return (await headers()).get('cookie');
}

export async function fetchUserProfile(userId: string): Promise<AuthUserPublic | null> {
  return getUser(userId, await getCookieHeader());
}

export async function fetchUserProfiles(userIds: string[]): Promise<Map<string, AuthUserPublic>> {
  const users = await batchGetUsers(userIds, await getCookieHeader());
  return buildUsersMap(users);
}

export async function searchAuthUsers(query: string): Promise<AuthUserPublic[]> {
  return searchUsers(query, await getCookieHeader());
}

export async function fetchDiscordLinkedUsers(): Promise<AuthUserPublic[]> {
  return listDiscordUsers(await getCookieHeader());
}

export async function fetchAllUserProfiles(): Promise<AuthUserPublic[]> {
  return listAllUsers(await getCookieHeader());
}

export function attachUserProfiles<T extends { userId: string }>(
  rows: T[],
  usersById: Map<string, AuthUserPublic>,
): Array<T & { user: { id: string; name: string; image: string | null } }> {
  return rows.map((row) => {
    const profile = usersById.get(row.userId);
    return {
      ...row,
      user: {
        id: row.userId,
        name: profile?.name ?? 'Utilisateur',
        image: profile?.image ?? null,
      },
    };
  });
}
