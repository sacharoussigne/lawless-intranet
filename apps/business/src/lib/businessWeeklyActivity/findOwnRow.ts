import type { SerializedBusinessWeeklyActivityRow } from '@/lib/businessWeeklyActivity/apiRow';

export function findOwnWeeklyActivityRow<
  T extends Pick<SerializedBusinessWeeklyActivityRow, 'userId' | 'discordUserId'>,
>(rows: T[], sessionUserId: string, viewerDiscordId: string | null): T | null {
  if (viewerDiscordId) {
    const byDiscord = rows.find((row) => row.discordUserId === viewerDiscordId);
    if (byDiscord) return byDiscord;
  }

  if (sessionUserId) {
    const byUser = rows.find((row) => row.userId === sessionUserId);
    if (byUser) return byUser;
  }

  return null;
}
