import type { BusinessType } from '@/lib/businessTypes';
import type { SerializedBusinessWeeklyActivityRow } from '@/lib/businessWeeklyActivity/apiRow';
import {
  legacyFieldsFromWeeklyCounters,
  weeklyCountersFromLegacyFields,
  type WeeklyCounters,
} from '@/lib/businessWeeklyActivity/counters';

/**
 * Bot API row: the row plus one field per counter (`patientsCount`…), as the
 * existing Discord bots read them (docs/api-dispensary-weekly-activity-bot.md).
 */
export function toBotApiRow(
  row: SerializedBusinessWeeklyActivityRow,
  type: BusinessType,
): SerializedBusinessWeeklyActivityRow & Record<string, unknown> {
  return { ...row, ...legacyFieldsFromWeeklyCounters(type, row.counters) };
}

/** Counters of a bot body: its legacy fields, then `counters` (which wins). */
export function countersFromBotBody(
  type: BusinessType,
  body: { counters?: WeeklyCounters } & Record<string, unknown>,
): WeeklyCounters | undefined {
  const counters = { ...weeklyCountersFromLegacyFields(type, body), ...(body.counters ?? {}) };
  return Object.keys(counters).length > 0 ? counters : undefined;
}
