import type { WeeklyActivityFieldVisibility } from '@/lib/businessWeeklyActivity/fieldVisibility';
import {
  WEEKDAY_KEYS,
  type WeekdayFlags,
} from '@/lib/businessWeeklyActivity/weekdayFlags';

export const COMPACT_DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

export function formatCompactDayCell(chest: boolean, presence: boolean): string {
  const chestMark = chest ? 'X' : '.';
  const presenceMark = presence ? 'P' : '.';
  return `${chestMark} ${presenceMark}`;
}

export function buildCompactDayCells(
  chestDays: WeekdayFlags,
  presenceDays: WeekdayFlags,
): string[] {
  return WEEKDAY_KEYS.map((key) => formatCompactDayCell(chestDays[key], presenceDays[key]));
}

export type CompactCounterStat = {
  label: string;
  value: number;
};

/** The visible counters of the business type, with their value (0 when missing). */
export function buildCompactCounterStats(
  counters: Record<string, number>,
  visibility: WeeklyActivityFieldVisibility,
): CompactCounterStat[] {
  return visibility.counters.map((c) => ({
    label: c.shortLabel ?? c.label,
    value: counters[c.key] ?? 0,
  }));
}

export function formatCompactCounterLine(stats: CompactCounterStat[]): string {
  return stats.map((s) => `${s.label}: ${s.value}`).join('  |  ');
}
