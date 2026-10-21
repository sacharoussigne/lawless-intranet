import { fetchBusinessUserProfiles } from '@/lib/people/userProfiles';
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
  businessId: string,
  rows: T[],
): Promise<Array<T & { user: UserProfile }>> {
  const [enriched] = await enrichRowGroupsWithUsers(businessId, [rows]);
  return enriched ?? [];
}

/** Several lists (members of every agenda…) in one user lookup instead of one per list. */
export async function enrichRowGroupsWithUsers<T extends { userId: string }>(
  businessId: string,
  groups: T[][],
): Promise<Array<Array<T & { user: UserProfile }>>> {
  const usersById = await fetchBusinessUserProfiles(
    businessId,
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
  businessId: string,
  members: T[],
) {
  return enrichRowsWithUsers(businessId, members);
}

export async function enrichEventParticipants<T extends { id: string; userId: string }>(
  businessId: string,
  participants: T[],
) {
  return enrichRowsWithUsers(businessId, participants);
}
