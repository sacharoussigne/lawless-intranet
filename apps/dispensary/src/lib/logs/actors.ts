import {
  resolveDiscordIdsForUserIds,
  resolveUsersByDiscordIds,
} from '@lawless-intranet/auth-client/internal';
import { fetchUserProfiles, searchAuthUsers } from '@/lib/authUsers';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import prisma from '@/lib/prisma';

/** Most ids a name search may expand to (keeps the `IN` lists small). */
const MAX_IDS = 200;

export type ActorIds = { userIds: string[]; discordIds: string[] };

const DISCORD_ID = /^\d{17,20}$/;

/** Runs a lookup against another service; a failure only narrows the search. */
async function bestEffort<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/**
 * Every id a log actor search can mean: the text itself as a user id or a
 * Discord id, the other id of the same person, and the people whose name
 * contains it (fixed or bot name of a dispensary person, intranet account name).
 * An account without Discord is found by its user id or its account name.
 */
export async function resolveActorIds(query: string): Promise<ActorIds> {
  const q = query.trim();
  const userIds = new Set<string>([q]);
  const discordIds = new Set<string>([q]);
  if (!q) return { userIds: [], discordIds: [] };

  // A user id is a long token without spaces: skip the lookup for ordinary names.
  const looksLikeUserId = !/\s/.test(q) && q.length >= 16 && !DISCORD_ID.test(q);
  const [accountsByDiscord, discordByUser, profiles, accounts] = await Promise.all([
    DISCORD_ID.test(q) ? bestEffort(() => resolveUsersByDiscordIds([q]), []) : Promise.resolve([]),
    looksLikeUserId
      ? bestEffort(() => resolveDiscordIdsForUserIds([q]), new Map<string, string>())
      : Promise.resolve(new Map<string, string>()),
    q.length >= 2
      ? prisma.dispensaryDiscordProfile.findMany({
          where: {
            OR: [
              { fixedDisplayName: { contains: q, mode: 'insensitive' } },
              { lastDisplayName: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { discordUserId: true, userId: true },
          take: MAX_IDS,
        })
      : Promise.resolve([]),
    q.length >= 2 ? bestEffort(() => searchAuthUsers(q), []) : Promise.resolve([]),
  ]);

  for (const account of accountsByDiscord) userIds.add(account.userId);
  for (const discordId of discordByUser.values()) discordIds.add(discordId);
  for (const profile of profiles) {
    discordIds.add(profile.discordUserId);
    if (profile.userId) userIds.add(profile.userId);
  }
  for (const account of accounts) {
    userIds.add(account.id);
    if (account.discordId) discordIds.add(account.discordId);
  }

  return {
    userIds: [...userIds].slice(0, MAX_IDS),
    discordIds: [...discordIds].slice(0, MAX_IDS),
  };
}

/**
 * Names of the actors of a page of logs, keyed by user id or Discord id:
 * the fixed name of the person when there is one, else the account name,
 * else the latest name sent by the bot.
 */
export async function resolveActorNames(
  rows: { userId: string | null; discordUserId: string | null }[],
): Promise<Record<string, string>> {
  const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id)))];
  const discordIds = [
    ...new Set(rows.map((r) => r.discordUserId).filter((id): id is string => Boolean(id))),
  ];
  if (userIds.length === 0 && discordIds.length === 0) return {};

  const [accounts, profiles, accountsByDiscord] = await Promise.all([
    bestEffort(() => fetchUserProfiles(userIds), new Map()),
    prisma.dispensaryDiscordProfile.findMany({
      where: {
        OR: [{ discordUserId: { in: discordIds } }, { userId: { in: userIds } }],
      },
      orderBy: { updatedAt: 'desc' },
      select: { discordUserId: true, userId: true, fixedDisplayName: true, lastDisplayName: true },
    }),
    bestEffort(() => resolveUsersByDiscordIds(discordIds), []),
  ]);

  // Several dispensaries may know the same person: a fixed name wins, then the most recent.
  const sorted = [...profiles].sort(
    (a, b) => Number(Boolean(b.fixedDisplayName?.trim())) - Number(Boolean(a.fixedDisplayName?.trim())),
  );
  const profileByDiscord = new Map<string, (typeof profiles)[number]>();
  const fixedByUser = new Map<string, string>();
  for (const profile of sorted) {
    if (!profileByDiscord.has(profile.discordUserId)) profileByDiscord.set(profile.discordUserId, profile);
    const fixed = profile.fixedDisplayName?.trim();
    if (profile.userId && fixed && !fixedByUser.has(profile.userId)) fixedByUser.set(profile.userId, fixed);
  }
  const accountNameByDiscord = new Map(accountsByDiscord.map((a) => [a.discordId, a.name]));

  const names: Record<string, string> = {};
  for (const userId of userIds) {
    const name = fixedByUser.get(userId) ?? accounts.get(userId)?.name;
    if (name) names[userId] = name;
  }
  for (const discordId of discordIds) {
    const profile = profileByDiscord.get(discordId);
    const fixed = profile?.fixedDisplayName?.trim();
    const name =
      fixed || accountNameByDiscord.get(discordId) || (profile ? pickProfileDisplayName(profile, '') : '');
    if (name) names[discordId] = name;
  }
  return names;
}
