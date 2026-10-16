import type { PrismaClient } from '@prisma/client';
import { discordIdOfUser, lookupDiscordIdsByUserIds } from '@/lib/people/accountLinks';

type WeeklyActivityDelegate = Pick<PrismaClient, 'dispensaryWeeklyActivity'>;
type ResolveDisplayNameDelegate = WeeklyActivityDelegate;

export function genericDoctorFallbackName(discordUserId: string): string {
  const fallback = `Médecin ${discordUserId}`;
  return fallback.length > 200 ? fallback.slice(0, 200) : fallback;
}

function isGenericDoctorFallbackName(displayName: string, discordUserId: string): boolean {
  const trimmed = displayName.trim();
  return trimmed.length === 0 || trimmed === genericDoctorFallbackName(discordUserId);
}

function trimDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

/** Latest real name of a Discord id in this dispensary (never another dispensary's). */
export async function getLatestDiscordDisplayName(
  prisma: WeeklyActivityDelegate,
  dispensaryId: string,
  discordUserId: string,
): Promise<string | null> {
  return (await getLatestDiscordDisplayNames(prisma, dispensaryId, [discordUserId])).get(discordUserId) ?? null;
}

export async function getLatestDiscordDisplayNames(
  prisma: WeeklyActivityDelegate,
  dispensaryId: string,
  discordUserIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(discordUserIds)];
  if (unique.length === 0) return new Map();

  const rows = await prisma.dispensaryWeeklyActivity.findMany({
    where: { dispensaryId, discordUserId: { in: unique } },
    orderBy: { updatedAt: 'desc' },
    select: { discordUserId: true, displayName: true },
  });

  const map = new Map<string, string>();
  for (const row of rows) {
    if (map.has(row.discordUserId)) continue;
    const name = row.displayName?.trim();
    if (!name || isGenericDoctorFallbackName(name, row.discordUserId)) continue;
    map.set(row.discordUserId, trimDisplayName(name));
  }
  return map;
}

export async function resolveDiscordDisplayName(
  prisma: ResolveDisplayNameDelegate,
  dispensaryId: string,
  discordUserId: string,
): Promise<string> {
  const latest = await getLatestDiscordDisplayName(prisma, dispensaryId, discordUserId);
  if (latest) return latest;
  return genericDoctorFallbackName(discordUserId);
}

/** Default `displayName` when the Discord bot auto-creates a weekly activity row. */
export async function resolveBotWeeklyActivityDisplayName(
  prisma: ResolveDisplayNameDelegate,
  dispensaryId: string,
  discordUserId: string,
): Promise<string> {
  return resolveDiscordDisplayName(prisma, dispensaryId, discordUserId);
}

/** Current Discord id of an account (`null`: none, or auth did not answer). Cached. */
export async function getDiscordAccountIdForUser(
  _prisma: unknown,
  userId: string,
): Promise<string | null> {
  return discordIdOfUser(userId);
}

/** Current Discord id of each account that has one. Cached; empty when auth did not answer. */
export async function getDiscordAccountIdsForUsers(
  userIds: string[],
): Promise<Map<string, string>> {
  const found = await lookupDiscordIdsByUserIds(userIds);
  return new Map(
    [...(found ?? [])].filter((entry): entry is [string, string] => entry[1] !== null),
  );
}

type RowWithDisplayName = {
  displayName: string;
  discordUserId: string;
};

export async function mergeResolvedDisplayNames<T extends RowWithDisplayName>(
  prisma: WeeklyActivityDelegate,
  dispensaryId: string,
  rows: T[],
): Promise<(T & { resolvedDisplayName: string })[]> {
  if (rows.length === 0) return [];

  const needLookup = rows.filter((r) => isGenericDoctorFallbackName(r.displayName, r.discordUserId));
  const discordIds = [...new Set(needLookup.map((r) => r.discordUserId))];
  const latestByDiscord = await getLatestDiscordDisplayNames(prisma, dispensaryId, discordIds);

  return rows.map((r) => {
    const stored = trimDisplayName(r.displayName);
    if (!isGenericDoctorFallbackName(stored, r.discordUserId)) {
      return { ...r, resolvedDisplayName: stored };
    }
    const latest = latestByDiscord.get(r.discordUserId);
    return {
      ...r,
      resolvedDisplayName: latest ?? genericDoctorFallbackName(r.discordUserId),
    };
  });
}
