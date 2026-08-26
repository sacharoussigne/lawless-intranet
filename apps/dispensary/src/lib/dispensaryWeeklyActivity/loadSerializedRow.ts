import { getAppSettings } from '@/lib/appSettings';
import prisma from '@/lib/prisma';
import {
  serializeDispensaryWeeklyActivityApiRow,
  type SerializedDispensaryWeeklyActivityRow,
} from '@/lib/dispensaryWeeklyActivity/apiRow';
import {
  redactSerializedWeeklyActivityRow,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import { attachDiscordProfilesToActivities } from '@/lib/dispensaryDiscordProfile/attachProfiles';
import { mergeResolvedDisplayNames } from '@/lib/dispensaryWeeklyActivity/resolveDisplayName';

export async function loadSerializedWeeklyActivityById(
  id: string,
): Promise<SerializedDispensaryWeeklyActivityRow | null> {
  const full = await prisma.dispensaryWeeklyActivity.findUnique({
    where: { id },
  });
  if (!full) return null;
  const [withName] = await mergeResolvedDisplayNames(prisma, [full]);
  const [withProfile] = await attachDiscordProfilesToActivities(prisma, [withName]);
  return serializeDispensaryWeeklyActivityApiRow({
    id: withProfile.id,
    periodStart: withProfile.periodStart,
    periodEnd: withProfile.periodEnd,
    displayName: withProfile.displayName,
    resolvedDisplayName: withProfile.resolvedDisplayName,
    discordProfileRole: withProfile.discordProfileRole,
    discordProfileAccountNumber: withProfile.discordProfileAccountNumber,
    discordUserId: withProfile.discordUserId,
    userId: withProfile.userId,
    chestDays: withProfile.chestDays,
    presenceDays: withProfile.presenceDays,
    sherifCount: withProfile.sherifCount,
    patientsCount: withProfile.patientsCount,
    infusionsCount: withProfile.infusionsCount,
    poppyMilkCount: withProfile.poppyMilkCount,
    createdAt: withProfile.createdAt,
    updatedAt: withProfile.updatedAt,
  });
}

export async function loadSerializedWeeklyActivityByIdForDispensary(
  id: string,
  dispensaryId: string,
): Promise<SerializedDispensaryWeeklyActivityRow | null> {
  const row = await loadSerializedWeeklyActivityById(id);
  if (!row) return null;
  const settings = await getAppSettings(dispensaryId);
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
  return redactSerializedWeeklyActivityRow(row, visibility);
}
