import { loadDiscordProfilesByIds, type ProfileDb } from '@/lib/businessDiscordProfile/queries';
import { pickProfileDisplayName } from '@/lib/people/displayName';

type ActivityWithResolvedName = {
  businessId: string;
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

  const businessIds = new Set(rows.map((r) => r.businessId));
  if (businessIds.size !== 1) {
    throw new Error('attachDiscordProfilesToActivities requires a single dispensary');
  }
  const businessId = rows[0]!.businessId;

  const profiles = await loadDiscordProfilesByIds(
    client,
    businessId,
    rows.map((r) => r.discordUserId),
  );

  return rows.map((row) => {
    const profile = profiles.get(row.discordUserId);
    return {
      ...row,
      resolvedDisplayName: pickProfileDisplayName(profile, row.resolvedDisplayName),
      discordProfileRole: profile?.role ?? null,
      discordProfileAccountNumber: profile?.accountNumber ?? null,
    };
  });
}
