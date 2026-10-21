import { describe, expect, it } from 'vitest';
import { normalizeAppSettings } from '@/lib/appSettingsShared';
import { businessTypes, type BusinessType } from '@/lib/businessTypes';
import { countersFromBotBody, toBotApiRow } from '@/lib/businessWeeklyActivity/botApiRow';
import type { SerializedBusinessWeeklyActivityRow } from '@/lib/businessWeeklyActivity/apiRow';
import {
  enabledWeeklyCounterDefinitions,
  legacyFieldsFromWeeklyCounters,
  parseWeeklyCounters,
  storedWeeklyCounters,
  weeklyCountersFromLegacyFields,
} from '@/lib/businessWeeklyActivity/counters';
import {
  applyVisibilityToUpdateInput,
  botPatchFieldVisibilityError,
  redactSerializedWeeklyActivityRow,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import { emptyWeekdayFlags } from '@/lib/businessWeeklyActivity/weekdayFlags';

describe('weekly counters storage', () => {
  it('keeps non-negative integers only', () => {
    expect(parseWeeklyCounters({ patients: 3, a: -1, b: 1.5, c: '2', d: null })).toEqual({
      patients: 3,
    });
    expect(parseWeeklyCounters(null)).toEqual({});
    expect(parseWeeklyCounters([1, 2])).toEqual({});
  });

  it('drops zeros when stored', () => {
    expect(storedWeeklyCounters({ patients: 0, sheriffs: 2 })).toEqual({ sheriffs: 2 });
  });
});

describe.each(Object.keys(businessTypes) as BusinessType[])('%s counters', (type) => {
  it('have unique keys and legacy fields', () => {
    const counters = businessTypes[type].weeklyCounters;
    expect(new Set(counters.map((c) => c.key)).size).toBe(counters.length);
    const legacy = counters.flatMap((c) => (c.legacyField ? [c.legacyField] : []));
    expect(new Set(legacy).size).toBe(legacy.length);
  });
});

describe('bot API legacy fields', () => {
  it('maps the dispensary fields both ways', () => {
    expect(
      weeklyCountersFromLegacyFields('DISPENSARY', { patientsCount: 4, sherifCount: 1, other: 9 }),
    ).toEqual({ patients: 4, sheriffs: 1 });
    expect(legacyFieldsFromWeeklyCounters('DISPENSARY', { patients: 4 })).toEqual({
      patientsCount: 4,
      sherifCount: 0,
      infusionsCount: 0,
      poppyMilkCount: 0,
    });
  });

  it('lets `counters` win over the legacy fields', () => {
    expect(
      countersFromBotBody('DISPENSARY', { patientsCount: 4, counters: { patients: 6, infusions: 1 } }),
    ).toEqual({ patients: 6, infusions: 1 });
    expect(countersFromBotBody('DISPENSARY', { displayName: 'x' })).toBeUndefined();
  });

  it('adds the legacy fields to the rows', () => {
    const row = { counters: { patients: 2 } } as unknown as SerializedBusinessWeeklyActivityRow;
    expect(toBotApiRow(row, 'DISPENSARY')).toMatchObject({ patientsCount: 2, poppyMilkCount: 0 });
  });
});

describe('counter visibility', () => {
  const settings = normalizeAppSettings({ weeklyActivityCounters: { sheriffs: false } });
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);

  it('leaves out the counters turned off in the settings', () => {
    expect(visibility.counters.map((c) => c.key)).toEqual(['patients', 'infusions', 'poppyMilk']);
    expect(
      enabledWeeklyCounterDefinitions('DISPENSARY', {}).map((c) => c.key),
    ).toEqual(['patients', 'sheriffs', 'infusions', 'poppyMilk']);
  });

  it('refuses hidden or unknown counters from the bot', () => {
    expect(botPatchFieldVisibilityError({ counters: { patients: 1 } }, visibility)).toBeNull();
    expect(botPatchFieldVisibilityError({ counters: { sheriffs: 1 } }, visibility)).not.toBeNull();
    expect(botPatchFieldVisibilityError({ counters: { unknown: 1 } }, visibility)).not.toBeNull();
  });

  it('drops hidden counters from an update and from the rows', () => {
    expect(
      applyVisibilityToUpdateInput({ counters: { patients: 1, sheriffs: 5 } }, visibility).counters,
    ).toEqual({ patients: 1 });

    const row = {
      chestDays: emptyWeekdayFlags(),
      presenceDays: emptyWeekdayFlags(),
      chestTotal: 0,
      presenceTotal: 0,
      chestDaysSummary: '',
      presenceDaysSummary: '',
      counters: { patients: 3, sheriffs: 7 },
    } as unknown as SerializedBusinessWeeklyActivityRow;
    expect(redactSerializedWeeklyActivityRow(row, visibility).counters).toEqual({
      patients: 3,
      infusions: 0,
      poppyMilk: 0,
    });
  });
});
