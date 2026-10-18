import type { Prisma } from '@prisma/client';
import type { BusinessWeeklyActivity } from '@prisma/client';
import { getAppSettings } from '@/lib/appSettings';
import prisma from '@/lib/prisma';
import { attachDiscordProfilesToActivities } from '@/lib/businessDiscordProfile/attachProfiles';
import {
  serializeBusinessWeeklyActivityApiRow,
  type SerializedBusinessWeeklyActivityRow,
} from '@/lib/businessWeeklyActivity/apiRow';
import {
  redactSerializedWeeklyActivityRow,
  weeklyActivityFieldVisibilityFromSettings,
  type WeeklyActivityFieldVisibility,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import { mergeResolvedDisplayNames } from '@/lib/businessWeeklyActivity/resolveDisplayName';
import { reconcileActivityUserIds } from '@/lib/businessWeeklyActivity/service';

type ActivityRowWithResolvedName = BusinessWeeklyActivity & {
  resolvedDisplayName: string;
  discordProfileRole: string | null;
  discordProfileAccountNumber: number | null;
};

export function serializeActivityRows(
  rows: ActivityRowWithResolvedName[],
  visibility: WeeklyActivityFieldVisibility,
): SerializedBusinessWeeklyActivityRow[] {
  return rows.map((r) =>
    redactSerializedWeeklyActivityRow(
      serializeBusinessWeeklyActivityApiRow({
        id: r.id,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        displayName: r.displayName,
        resolvedDisplayName: r.resolvedDisplayName,
        discordProfileRole: r.discordProfileRole,
        discordProfileAccountNumber: r.discordProfileAccountNumber,
        discordUserId: r.discordUserId,
        userId: r.userId,
        chestDays: r.chestDays,
        presenceDays: r.presenceDays,
        sherifCount: r.sherifCount,
        patientsCount: r.patientsCount,
        infusionsCount: r.infusionsCount,
        poppyMilkCount: r.poppyMilkCount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
      visibility,
    ),
  );
}

export async function listSerializedWeeklyActivities(
  where: Prisma.BusinessWeeklyActivityWhereInput,
  businessId: string,
  orderBy: Prisma.BusinessWeeklyActivityOrderByWithRelationInput | Prisma.BusinessWeeklyActivityOrderByWithRelationInput[] = {
    periodStart: 'desc',
  },
): Promise<SerializedBusinessWeeklyActivityRow[]> {
  const rows = await prisma.businessWeeklyActivity.findMany({ where, orderBy });
  const synced = await reconcileActivityUserIds(rows);
  const withNames = await mergeResolvedDisplayNames(prisma, businessId, synced);
  const withProfiles = await attachDiscordProfilesToActivities(prisma, withNames);
  const settings = await getAppSettings(businessId);
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
  return serializeActivityRows(withProfiles, visibility);
}
