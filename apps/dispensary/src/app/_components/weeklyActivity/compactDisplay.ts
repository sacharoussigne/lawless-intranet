import type { WeeklyActivityFieldVisibility } from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import {
  WEEKDAY_KEYS,
  type WeekdayFlags,
} from '@/lib/dispensaryWeeklyActivity/weekdayFlags';

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

export function buildCompactCounterStats(
  row: {
    patientsCount: number;
    sherifCount: number;
    infusionsCount: number;
    poppyMilkCount: number;
  },
  visibility: WeeklyActivityFieldVisibility,
): CompactCounterStat[] {
  const stats: CompactCounterStat[] = [];
  if (visibility.patientsCount) {
    stats.push({ label: 'Patients', value: row.patientsCount });
  }
  if (visibility.sherifCount) {
    stats.push({ label: 'Shérifs', value: row.sherifCount });
  }
  if (visibility.infusionsCount) {
    stats.push({ label: 'Inf. ginseng', value: row.infusionsCount });
  }
  if (visibility.poppyMilkCount) {
    stats.push({ label: 'Lait pavot', value: row.poppyMilkCount });
  }
  return stats;
}

export function formatCompactCounterLine(stats: CompactCounterStat[]): string {
  return stats.map((s) => `${s.label} : ${s.value}`).join('  |  ');
}
