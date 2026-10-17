import { fetchDispensaryUserProfiles } from '@/lib/people/userProfiles';
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

/** Rows with their user, named as in the dispensary (fixed name first). */
export async function enrichRowsWithUsers<T extends { userId: string }>(
  dispensaryId: string,
  rows: T[],
): Promise<Array<T & { user: UserProfile }>> {
  const [enriched] = await enrichRowGroupsWithUsers(dispensaryId, [rows]);
  return enriched ?? [];
}

/** Several lists (members of every agenda…) in one user lookup instead of one per list. */
export async function enrichRowGroupsWithUsers<T extends { userId: string }>(
  dispensaryId: string,
  groups: T[][],
): Promise<Array<Array<T & { user: UserProfile }>>> {
  const usersById = await fetchDispensaryUserProfiles(
    dispensaryId,
    groups.flatMap((rows) => rows.map((row) => row.userId)),
  );
  return groups.map((rows) =>
    rows.map((row) => ({
      ...row,
      user: toUserProfile(usersById.get(row.userId), row.userId),
    })),
  );
}

export async function enrichAgendaMembers<T extends { userId: string }>(
  dispensaryId: string,
  members: T[],
) {
  return enrichRowsWithUsers(dispensaryId, members);
}

export async function enrichEventParticipants<T extends { id: string; userId: string }>(
  dispensaryId: string,
  participants: T[],
) {
  return enrichRowsWithUsers(dispensaryId, participants);
}
