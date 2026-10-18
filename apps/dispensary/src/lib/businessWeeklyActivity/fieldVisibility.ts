import { APP_SETTINGS_DEFAULTS, type AppSettingsDTO } from '@/lib/appSettingsShared';
import type { WeeklyCounterDefinition } from '@/lib/businessTypes';
import type { SerializedBusinessWeeklyActivityRow } from '@/lib/businessWeeklyActivity/apiRow';
import {
  enabledWeeklyCounterDefinitions,
  type WeeklyCounters,
} from '@/lib/businessWeeklyActivity/counters';
import type {
  BusinessWeeklyActivityCreateInput,
  BusinessWeeklyActivityUpdateInput,
} from '@/lib/businessWeeklyActivity/schemas';
import {
  emptyWeekdayFlags,
  formatWeekdayFlagsSummary,
} from '@/lib/businessWeeklyActivity/weekdayFlags';

export type WeeklyActivityFieldVisibility = {
  chestDays: boolean;
  presenceDays: boolean;
  /** Counters of the business type that are not turned off, in display order. */
  counters: WeeklyCounterDefinition[];
};

export function weeklyActivityFieldVisibilityFromSettings(
  settings: AppSettingsDTO,
): WeeklyActivityFieldVisibility {
  const d = APP_SETTINGS_DEFAULTS;
  return {
    chestDays: settings.weeklyActivityChestDaysVisible ?? d.weeklyActivityChestDaysVisible,
    presenceDays: settings.weeklyActivityPresenceDaysVisible ?? d.weeklyActivityPresenceDaysVisible,
    counters: enabledWeeklyCounterDefinitions(
      settings.businessType,
      settings.weeklyActivityCounters ?? d.weeklyActivityCounters,
    ),
  };
}

export function isWeeklyCounterVisible(
  visibility: WeeklyActivityFieldVisibility,
  key: string,
): boolean {
  return visibility.counters.some((c) => c.key === key);
}

/** Only the visible counters (the others, hidden or unknown, are dropped). */
function visibleCounters(
  counters: WeeklyCounters,
  visibility: WeeklyActivityFieldVisibility,
): WeeklyCounters {
  return Object.fromEntries(
    Object.entries(counters).filter(([key]) => isWeeklyCounterVisible(visibility, key)),
  );
}

export function applyVisibilityToCreateInput(
  input: BusinessWeeklyActivityCreateInput,
  visibility: WeeklyActivityFieldVisibility,
): BusinessWeeklyActivityCreateInput {
  return {
    ...input,
    chestDays: visibility.chestDays ? input.chestDays : emptyWeekdayFlags(),
    presenceDays: visibility.presenceDays ? input.presenceDays : emptyWeekdayFlags(),
    counters: visibleCounters(input.counters ?? {}, visibility),
  };
}

export function applyVisibilityToUpdateInput(
  input: BusinessWeeklyActivityUpdateInput,
  visibility: WeeklyActivityFieldVisibility,
): BusinessWeeklyActivityUpdateInput {
  const out: BusinessWeeklyActivityUpdateInput = { ...input };
  if (!visibility.chestDays) delete out.chestDays;
  if (!visibility.presenceDays) delete out.presenceDays;
  if (out.counters) out.counters = visibleCounters(out.counters, visibility);
  return out;
}

export function redactSerializedWeeklyActivityRow(
  row: SerializedBusinessWeeklyActivityRow,
  visibility: WeeklyActivityFieldVisibility,
): SerializedBusinessWeeklyActivityRow {
  const emptyChest = emptyWeekdayFlags();
  const emptyPresence = emptyWeekdayFlags();
  return {
    ...row,
    chestDays: visibility.chestDays ? row.chestDays : emptyChest,
    presenceDays: visibility.presenceDays ? row.presenceDays : emptyPresence,
    chestTotal: visibility.chestDays ? row.chestTotal : 0,
    presenceTotal: visibility.presenceDays ? row.presenceTotal : 0,
    chestDaysSummary: visibility.chestDays
      ? row.chestDaysSummary
      : formatWeekdayFlagsSummary(emptyChest),
    presenceDaysSummary: visibility.presenceDays
      ? row.presenceDaysSummary
      : formatWeekdayFlagsSummary(emptyPresence),
    // Every visible counter (0 when missing); the hidden ones are left out.
    counters: Object.fromEntries(visibility.counters.map((c) => [c.key, row.counters[c.key] ?? 0])),
  };
}

const BOT_FIELD_ERROR = 'Ce champ est masqué pour ce dispensaire.';

export function botPatchFieldVisibilityError(
  body: BusinessWeeklyActivityUpdateInput,
  visibility: WeeklyActivityFieldVisibility,
): string | null {
  if (body.chestDays !== undefined && !visibility.chestDays) return BOT_FIELD_ERROR;
  if (body.presenceDays !== undefined && !visibility.presenceDays) return BOT_FIELD_ERROR;
  for (const key of Object.keys(body.counters ?? {})) {
    if (!isWeeklyCounterVisible(visibility, key)) return BOT_FIELD_ERROR;
  }
  return null;
}

export function botWeekdayFieldVisibilityError(
  field: 'chest' | 'presence',
  visibility: WeeklyActivityFieldVisibility,
): string | null {
  if (field === 'chest' && !visibility.chestDays) return BOT_FIELD_ERROR;
  if (field === 'presence' && !visibility.presenceDays) return BOT_FIELD_ERROR;
  return null;
}
