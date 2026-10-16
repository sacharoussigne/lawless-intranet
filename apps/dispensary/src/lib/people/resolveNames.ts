import type { PrismaClient } from '@prisma/client';
import {
  resolveDiscordIdsForUserIds,
  resolveUsersByDiscordIds,
} from '@lawless-intranet/auth-client/internal';
import { applyFixedNames } from '@/lib/people/displayName';

type ProfileDb = Pick<PrismaClient, 'dispensaryDiscordProfile'>;

/**
 * Links the profiles that have no account yet to the account now holding their
 * Discord ID (a person who signed up after being added). Same Discord ID, so
 * same profile: no duplicate, history kept.
 */
async function linkProfiles(
  client: ProfileDb,
  dispensaryId: string,
  links: { discordUserId: string; userId: string }[],
): Promise<void> {
  await Promise.all(
    links.map(({ discordUserId, userId }) =>
      client.dispensaryDiscordProfile.updateMany({
        where: { dispensaryId, discordUserId, userId: null },
        data: { userId },
      }),
    ),
  );
}

/** Links every profile of the dispensary that has no account yet, when one exists. */
export async function linkUnlinkedProfiles(client: ProfileDb, dispensaryId: string): Promise<void> {
  const unlinked = await client.dispensaryDiscordProfile.findMany({
    where: { dispensaryId, userId: null },
    select: { discordUserId: true },
  });
  if (unlinked.length === 0) return;
  const accounts = await resolveUsersByDiscordIds(unlinked.map((p) => p.discordUserId));
  await linkProfiles(
    client,
    dispensaryId,
    accounts.map((a) => ({ discordUserId: a.discordId, userId: a.userId })),
  );
}

/** Fixed names of intranet accounts (userId → name), through their Discord profile. */
export async function loadFixedNamesForUsers(
  client: ProfileDb,
  dispensaryId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  const linked = await client.dispensaryDiscordProfile.findMany({
    where: { dispensaryId, userId: { in: unique } },
    select: { userId: true, fixedDisplayName: true },
  });
  for (const profile of linked) {
    const fixed = profile.fixedDisplayName?.trim();
    if (profile.userId && fixed) names.set(profile.userId, fixed);
  }

  // Accounts without a linked profile: maybe a profile created before the account.
  const linkedUserIds = new Set(linked.map((p) => p.userId));
  const missing = unique.filter((id) => !linkedUserIds.has(id));
  if (missing.length === 0) return names;

  const discordByUser = await resolveDiscordIdsForUserIds(missing);
  if (discordByUser.size === 0) return names;
  const userByDiscord = new Map([...discordByUser].map(([userId, discordId]) => [discordId, userId]));

  const unlinked = await client.dispensaryDiscordProfile.findMany({
    where: { dispensaryId, userId: null, discordUserId: { in: [...userByDiscord.keys()] } },
    select: { discordUserId: true, fixedDisplayName: true },
  });
  const links = unlinked.flatMap((profile) => {
    const userId = userByDiscord.get(profile.discordUserId);
    if (!userId) return [];
    const fixed = profile.fixedDisplayName?.trim();
    if (fixed) names.set(userId, fixed);
    return [{ discordUserId: profile.discordUserId, userId }];
  });
  await linkProfiles(client, dispensaryId, links);

  return names;
}

/**
 * Names of intranet accounts as shown in the dispensary: the fixed name of the
 * person when there is one, the SSO name otherwise. Best effort: if the auth
 * service does not answer, the SSO names are kept.
 */
export async function applyDispensaryNamesToUsers<T extends { name: string }>(
  client: ProfileDb,
  dispensaryId: string,
  usersById: Map<string, T>,
): Promise<Map<string, T>> {
  try {
    const fixed = await loadFixedNamesForUsers(client, dispensaryId, [...usersById.keys()]);
    return applyFixedNames(usersById, fixed);
  } catch {
    return usersById;
  }
}
