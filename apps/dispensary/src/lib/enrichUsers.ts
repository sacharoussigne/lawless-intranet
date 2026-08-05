import { fetchUserProfiles } from '@/lib/authUsers';
import type { AuthUserPublic } from '@lawless-intranet/types';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export function toUserProfile(
  user: AuthUserPublic | null | undefined,
  fallbackId?: string,
): UserProfile {
  if (user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email ?? '',
      image: user.image,
    };
  }

  return {
    id: fallbackId ?? 'unknown',
    name: 'Utilisateur',
    email: '',
    image: null,
  };
}

export async function enrichRowsWithUsers<T extends { userId: string }>(
  rows: T[],
): Promise<Array<T & { user: UserProfile }>> {
  const usersById = await fetchUserProfiles(rows.map((row) => row.userId));
  return rows.map((row) => ({
    ...row,
    user: toUserProfile(usersById.get(row.userId), row.userId),
  }));
}

export async function enrichAgendaMembers<T extends { userId: string }>(members: T[]) {
  return enrichRowsWithUsers(members);
}

export async function enrichEventParticipants<
  T extends { id: string; userId: string },
>(participants: T[]) {
  return enrichRowsWithUsers(participants);
}
