import type { AuthUser, AuthUserPublic, UserGender } from '@lawless-intranet/types';
import prisma from '@/lib/prisma';
import { DISCORD_PROVIDER_ID } from '@/lib/constants';

type UserRecord = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  gender?: string | null;
};

function normalizeUserGender(gender: string | null | undefined): UserGender {
  return gender === 'female' ? 'female' : 'male';
}

export async function getDiscordIdForUser(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: DISCORD_PROVIDER_ID,
    },
    select: { accountId: true },
  });

  return account?.accountId ?? null;
}

export async function getDiscordIdsForUsers(
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const accounts = await prisma.account.findMany({
    where: {
      userId: { in: userIds },
      providerId: DISCORD_PROVIDER_ID,
    },
    select: { userId: true, accountId: true },
  });

  return new Map(accounts.map((account) => [account.userId, account.accountId]));
}

export async function toAuthUser(user: UserRecord): Promise<AuthUser> {
  const [discordId, credentialAccount] = await Promise.all([
    getDiscordIdForUser(user.id),
    prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: 'credential',
        password: { not: null },
      },
      select: { id: true },
    }),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: user.role ?? null,
    gender: normalizeUserGender(user.gender),
    discordId,
    hasCredentialPassword: Boolean(credentialAccount),
  };
}

export async function toAuthUsers(users: UserRecord[]): Promise<AuthUser[]> {
  const discordIds = await getDiscordIdsForUsers(users.map((user) => user.id));

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: user.role ?? null,
    gender: normalizeUserGender(user.gender),
    discordId: discordIds.get(user.id) ?? null,
  }));
}

export function toAuthUserPublic(user: AuthUser): AuthUserPublic {
  return {
    id: user.id,
    name: user.name,
    image: user.image ?? null,
    discordId: user.discordId,
    email: user.email,
    role: user.role ?? null,
    gender: user.gender ?? 'male',
  };
}
