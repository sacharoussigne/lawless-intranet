import {
  getBusinessTypeDefinition,
  type BusinessType,
  type WeeklyCounterDefinition,
} from '@/lib/businessTypes';

/** Counter values of a weekly activity row: key → value (a missing key is 0). */
export type WeeklyCounters = Record<string, number>;

/** Reads the `counters` JSON (row or history snapshot): keeps non-negative integers only. */
export function parseWeeklyCounters(json: unknown): WeeklyCounters {
  const out: WeeklyCounters = {};
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out;
  for (const [key, value] of Object.entries(json)) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) out[key] = value;
  }
  return out;
}

/** What is stored: zeros are dropped. */
export function storedWeeklyCounters(counters: WeeklyCounters): WeeklyCounters {
  return Object.fromEntries(Object.entries(counters).filter(([, value]) => value > 0));
}

export function weeklyCounterValue(counters: WeeklyCounters, key: string): number {
  return counters[key] ?? 0;
}

export function weeklyCounterDefinitions(type: BusinessType): readonly WeeklyCounterDefinition[] {
  return getBusinessTypeDefinition(type).weeklyCounters;
}

export function findWeeklyCounterDefinition(
  type: BusinessType,
  key: string,
): WeeklyCounterDefinition | undefined {
  return weeklyCounterDefinitions(type).find((c) => c.key === key);
}

/** Every counter of the type, with its value (0 when missing). */
export function completeWeeklyCounters(type: BusinessType, counters: WeeklyCounters): WeeklyCounters {
  return Object.fromEntries(
    weeklyCounterDefinitions(type).map((c) => [c.key, weeklyCounterValue(counters, c.key)]),
  );
}

/** Settings map (`AppSettings.weeklyActivityCounters`): a missing key is enabled. */
export function isWeeklyCounterEnabled(settingsCounters: Record<string, boolean>, key: string): boolean {
  return settingsCounters[key] !== false;
}

/** Counters of the type that the business has not turned off, in display order. */
export function enabledWeeklyCounterDefinitions(
  type: BusinessType,
  settingsCounters: Record<string, boolean>,
): WeeklyCounterDefinition[] {
  return weeklyCounterDefinitions(type).filter((c) => isWeeklyCounterEnabled(settingsCounters, c.key));
}

/** Reads the settings map (`AppSettings.weeklyActivityCounters` JSON). */
export function parseWeeklyCounterSettings(json: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out;
  for (const [key, value] of Object.entries(json)) {
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

/* Bot API: the existing bots send and read one field per counter (`patientsCount`…). */

/** Counters given through their legacy fields in a bot body. */
export function weeklyCountersFromLegacyFields(
  type: BusinessType,
  body: Record<string, unknown>,
): WeeklyCounters {
  const out: WeeklyCounters = {};
  for (const c of weeklyCounterDefinitions(type)) {
    if (!c.legacyField) continue;
    const value = body[c.legacyField];
    if (typeof value === 'number') out[c.key] = value;
  }
  return out;
}

/** Legacy field of each counter that has one, for the bot API rows. */
export function legacyFieldsFromWeeklyCounters(
  type: BusinessType,
  counters: WeeklyCounters,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of weeklyCounterDefinitions(type)) {
    if (c.legacyField) out[c.legacyField] = weeklyCounterValue(counters, c.key);
  }
  return out;
}
