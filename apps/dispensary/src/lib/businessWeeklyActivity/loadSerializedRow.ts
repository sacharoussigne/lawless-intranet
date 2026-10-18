import { getAppSettings } from '@/lib/appSettings';
import prisma from '@/lib/prisma';
import {
  serializeBusinessWeeklyActivityApiRow,
  type SerializedBusinessWeeklyActivityRow,
} from '@/lib/businessWeeklyActivity/apiRow';
import {
  redactSerializedWeeklyActivityRow,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import { attachDiscordProfilesToActivities } from '@/lib/businessDiscordProfile/attachProfiles';
import { mergeResolvedDisplayNames } from '@/lib/businessWeeklyActivity/resolveDisplayName';

export async function loadSerializedWeeklyActivityById(
  id: string,
): Promise<SerializedBusinessWeeklyActivityRow | null> {
  const full = await prisma.businessWeeklyActivity.findUnique({
    where: { id },
  });
  if (!full) return null;
  const [withName] = await mergeResolvedDisplayNames(prisma, full.businessId, [full]);
  const [withProfile] = await attachDiscordProfilesToActivities(prisma, [withName]);
  return serializeBusinessWeeklyActivityApiRow({
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

export async function loadSerializedWeeklyActivityByIdForBusiness(
  id: string,
  businessId: string,
): Promise<SerializedBusinessWeeklyActivityRow | null> {
  const row = await loadSerializedWeeklyActivityById(id);
  if (!row) return null;
  const settings = await getAppSettings(businessId);
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
  return redactSerializedWeeklyActivityRow(row, visibility);
}
