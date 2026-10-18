import type { BusinessWeeklyActivity } from '@prisma/client';
import { parseWeekdayFlagsJson, type WeekdayFlags } from '@/lib/businessWeeklyActivity/weekdayFlags';

export type ActivitySnapshotJson = {
  periodStart: string;
  periodEnd: string;
  displayName: string;
  discordUserId: string;
  userId: string | null;
  chestDays: WeekdayFlags;
  presenceDays: WeekdayFlags;
  sherifCount: number;
  patientsCount: number;
  infusionsCount: number;
  poppyMilkCount: number;
};

export function activityToSnapshot(activity: BusinessWeeklyActivity): ActivitySnapshotJson {
  return {
    periodStart: activity.periodStart.toISOString(),
    periodEnd: activity.periodEnd.toISOString(),
    displayName: activity.displayName,
    discordUserId: activity.discordUserId,
    userId: activity.userId,
    chestDays: parseWeekdayFlagsJson(activity.chestDays),
    presenceDays: parseWeekdayFlagsJson(activity.presenceDays),
    sherifCount: activity.sherifCount,
    patientsCount: activity.patientsCount,
    infusionsCount: activity.infusionsCount,
    poppyMilkCount: activity.poppyMilkCount,
  };
}
