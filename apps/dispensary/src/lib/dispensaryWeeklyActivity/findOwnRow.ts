import type { SerializedDispensaryWeeklyActivityRow } from '@/lib/dispensaryWeeklyActivity/apiRow';

export function findOwnWeeklyActivityRow<
  T extends Pick<SerializedDispensaryWeeklyActivityRow, 'userId' | 'discordUserId'>,
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
