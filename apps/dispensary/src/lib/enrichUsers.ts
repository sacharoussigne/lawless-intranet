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

type BankAccountAccessRow = {
  id: string;
  accountId: string;
  userId: string;
  accessType: string;
  createdAt: Date;
  updatedAt: Date;
};

type BankAccountRow = {
  id: string;
  dispensaryId: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  accesses?: BankAccountAccessRow[];
};

export async function enrichBankAccount<T extends BankAccountRow>(
  account: T,
): Promise<
  T & {
    owner: UserProfile;
    accesses: Array<BankAccountAccessRow & { user: UserProfile }>;
  }
> {
  const userIds = [
    account.ownerId,
    ...(account.accesses?.map((access) => access.userId) ?? []),
  ];
  const usersById = await fetchUserProfiles(userIds);

  return {
    ...account,
    owner: toUserProfile(usersById.get(account.ownerId), account.ownerId),
    accesses: (account.accesses ?? []).map((access) => ({
      ...access,
      user: toUserProfile(usersById.get(access.userId), access.userId),
    })),
  } as T & {
    owner: UserProfile;
    accesses: Array<BankAccountAccessRow & { user: UserProfile }>;
  };
}

export async function enrichBankAccounts<T extends BankAccountRow>(accounts: T[]) {
  const userIds = accounts.flatMap((account) => [
    account.ownerId,
    ...(account.accesses?.map((access) => access.userId) ?? []),
  ]);
  const usersById = await fetchUserProfiles(userIds);

  return accounts.map((account) => ({
    ...account,
    owner: toUserProfile(usersById.get(account.ownerId), account.ownerId),
    accesses: (account.accesses ?? []).map((access) => ({
      ...access,
      user: toUserProfile(usersById.get(access.userId), access.userId),
    })),
  })) as Array<
    T & {
      owner: UserProfile;
      accesses: Array<BankAccountAccessRow & { user: UserProfile }>;
    }
  >;
}

export async function enrichAgendaMembers<T extends { userId: string }>(members: T[]) {
  return enrichRowsWithUsers(members);
}

export async function enrichEventParticipants<
  T extends { id: string; userId: string },
>(participants: T[]) {
  return enrichRowsWithUsers(participants);
}
