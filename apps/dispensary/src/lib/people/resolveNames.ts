import type { PrismaClient } from '@prisma/client';
import { lookupDiscordIdsByUserIds } from '@/lib/people/accountLinks';
import { getLatestDiscordDisplayName } from '@/lib/businessWeeklyActivity/resolveDisplayName';
import { applyFixedNames, pickProfileDisplayName } from '@/lib/people/displayName';

type ProfileDb = Pick<PrismaClient, 'businessDiscordProfile'>;

/** Fixed names of intranet accounts (userId → name), through their Discord profile. */
export async function loadFixedNamesForUsers(
  client: ProfileDb,
  businessId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  // The person of an account is its current Discord id (cached lookup); the
  // stored `userId` is only a fallback when auth does not answer.
  const discordByUser = await lookupDiscordIdsByUserIds(unique);
  const currentDiscordIds = [...(discordByUser?.values() ?? [])].filter(
    (id): id is string => Boolean(id),
  );

  const profiles = await client.businessDiscordProfile.findMany({
    where: {
      businessId,
      fixedDisplayName: { not: null },
      OR: [
        { discordUserId: { in: currentDiscordIds } },
        ...(discordByUser ? [] : [{ userId: { in: unique } }]),
      ],
    },
    orderBy: { updatedAt: 'desc' },
    select: { discordUserId: true, userId: true, fixedDisplayName: true },
  });
  const byDiscord = new Map(profiles.map((p) => [p.discordUserId, p]));

  for (const userId of unique) {
    const discordId = discordByUser?.get(userId);
    const profile = discordByUser
      ? discordId
        ? byDiscord.get(discordId)
        : undefined
      : profiles.find((p) => p.userId === userId);
    const fixed = profile?.fixedDisplayName?.trim();
    if (fixed) names.set(userId, fixed);
  }
  return names;
}

/**
 * Names of intranet accounts as shown in the dispensary: the fixed name of the
 * person when there is one, the SSO name otherwise. Best effort: if the auth
 * service does not answer, the SSO names are kept.
 */
export async function applyBusinessNamesToUsers<T extends { name: string }>(
  client: ProfileDb,
  businessId: string,
  usersById: Map<string, T>,
): Promise<Map<string, T>> {
  try {
    const fixed = await loadFixedNamesForUsers(client, businessId, [...usersById.keys()]);
    return applyFixedNames(usersById, fixed);
  } catch {
    return usersById;
  }
}

/**
 * Name of a Discord id in this dispensary: fixed name, then the latest name of
 * its profile or rows here, then `fallback` (SSO name, « Médecin <id> »…).
 */
export async function resolveDiscordPersonName(
  client: ProfileDb & Pick<PrismaClient, 'businessWeeklyActivity'>,
  businessId: string,
  discordUserId: string,
  fallback: string,
): Promise<string> {
  const [profile, latest] = await Promise.all([
    client.businessDiscordProfile.findUnique({
      where: { businessId_discordUserId: { businessId, discordUserId } },
      select: { fixedDisplayName: true, lastDisplayName: true },
    }),
    getLatestDiscordDisplayName(client, businessId, discordUserId),
  ]);
  return pickProfileDisplayName(profile, latest ?? fallback);
}

/** Accounts whose name in this dispensary (fixed or bot name) contains `query`: pickers find people by it too. */
export async function findUserIdsByBusinessName(
  client: ProfileDb,
  businessId: string,
  query: string,
): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const profiles = await client.businessDiscordProfile.findMany({
    where: {
      businessId,
      userId: { not: null },
      OR: [
        { fixedDisplayName: { contains: q, mode: 'insensitive' } },
        { lastDisplayName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { userId: true },
    take: 50,
  });
  return profiles.map((p) => p.userId).filter((id): id is string => Boolean(id));
}
