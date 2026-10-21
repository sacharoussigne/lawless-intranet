import type { WeekdayFlags } from '@/lib/businessWeeklyActivity/weekdayFlags';
import { parseWeeklyCounters, type WeeklyCounters } from '@/lib/businessWeeklyActivity/counters';
import {
  countWeekdayTrues,
  formatWeekdayFlagsSummary,
  parseWeekdayFlagsJson,
} from '@/lib/businessWeeklyActivity/weekdayFlags';

type RowLike = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  displayName: string;
  resolvedDisplayName: string;
  discordProfileRole: string | null;
  discordProfileAccountNumber: number | null;
  discordUserId: string;
  userId: string | null;
  chestDays: unknown;
  presenceDays: unknown;
  counters: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type SerializedBusinessWeeklyActivityRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  displayName: string;
  resolvedDisplayName: string;
  discordProfileRole: string | null;
  discordProfileAccountNumber: number | null;
  discordUserId: string;
  userId: string | null;
  chestDays: WeekdayFlags;
  presenceDays: WeekdayFlags;
  chestTotal: number;
  presenceTotal: number;
  chestDaysSummary: string;
  presenceDaysSummary: string;
  /** Counter values by key (lib/businessTypes `weeklyCounters`). */
  counters: WeeklyCounters;
  createdAt: string;
  updatedAt: string;
};

export function serializeBusinessWeeklyActivityApiRow(r: RowLike): SerializedBusinessWeeklyActivityRow {
  const chestDays = parseWeekdayFlagsJson(r.chestDays);
  const presenceDays = parseWeekdayFlagsJson(r.presenceDays);
  return {
    id: r.id,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    displayName: r.displayName,
    resolvedDisplayName: r.resolvedDisplayName,
    discordProfileRole: r.discordProfileRole,
    discordProfileAccountNumber: r.discordProfileAccountNumber,
    discordUserId: r.discordUserId,
    userId: r.userId,
    chestDays,
    presenceDays,
    chestTotal: countWeekdayTrues(chestDays),
    presenceTotal: countWeekdayTrues(presenceDays),
    chestDaysSummary: formatWeekdayFlagsSummary(chestDays),
    presenceDaysSummary: formatWeekdayFlagsSummary(presenceDays),
    counters: parseWeeklyCounters(r.counters),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
