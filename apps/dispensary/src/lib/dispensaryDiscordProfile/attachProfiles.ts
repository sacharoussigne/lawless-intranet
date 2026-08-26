import type { PrismaClient } from '@prisma/client';
import { loadDiscordProfilesByIds } from '@/lib/dispensaryDiscordProfile/service';

type ProfileDb = Pick<PrismaClient, 'dispensaryDiscordProfile'>;

type ActivityWithResolvedName = {
  dispensaryId: string;
  discordUserId: string;
  resolvedDisplayName: string;
};

export type ActivityWithDiscordProfile = ActivityWithResolvedName & {
  discordProfileRole: string | null;
  discordProfileAccountNumber: number | null;
};

export async function attachDiscordProfilesToActivities<T extends ActivityWithResolvedName>(
  client: ProfileDb,
  rows: T[],
): Promise<(T & { discordProfileRole: string | null; discordProfileAccountNumber: number | null })[]> {
  if (rows.length === 0) return [];

  const dispensaryIds = new Set(rows.map((r) => r.dispensaryId));
  if (dispensaryIds.size !== 1) {
    throw new Error('attachDiscordProfilesToActivities requires a single dispensary');
  }
  const dispensaryId = rows[0]!.dispensaryId;

  const profiles = await loadDiscordProfilesByIds(
    client,
    dispensaryId,
    rows.map((r) => r.discordUserId),
  );

  return rows.map((row) => {
    const profile = profiles.get(row.discordUserId);
    const profileName = profile?.lastDisplayName.trim();
    return {
      ...row,
      resolvedDisplayName: profileName || row.resolvedDisplayName,
      discordProfileRole: profile?.role ?? null,
      discordProfileAccountNumber: profile?.accountNumber ?? null,
    };
  });
}
