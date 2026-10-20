import { describe, expect, it } from 'vitest';
import { emptyWeekdayFlags } from '@/lib/businessWeeklyActivity/weekdayFlags';
import { formatHistoryValueChanges } from '@/lib/businessWeeklyActivity/historyValueDiff';
import { businessTypes } from '@/lib/businessTypes';

const baseSnapshot = {
  periodStart: '2026-05-11T00:00:00.000Z',
  periodEnd: '2026-05-17T23:59:59.999Z',
  displayName: 'Dr. House',
  discordUserId: '123',
  userId: null,
  chestDays: emptyWeekdayFlags(),
  presenceDays: emptyWeekdayFlags(),
  counters: {},
};

const COUNTERS = businessTypes.DISPENSARY.weeklyCounters;

describe('formatHistoryValueChanges', () => {
  it('returns changed fields for snapshot updates', () => {
    const previous = {
      ...baseSnapshot,
      counters: { patients: 2 },
      chestDays: { ...emptyWeekdayFlags(), lundi: true },
    };
    const next = {
      ...baseSnapshot,
      counters: { patients: 5 },
      chestDays: { ...emptyWeekdayFlags(), lundi: true, mardi: true },
    };

    expect(formatHistoryValueChanges('UPDATE', previous, next, COUNTERS)).toEqual([
      'Caisses : ✓······ → ✓✓·····',
      'Patients : 2 → 5',
    ]);
  });

  it('formats bot day field changes', () => {
    expect(
      formatHistoryValueChanges(
        'UPDATE_CHEST_DAYS',
        { day: 'mercredi', date: '2026-05-14', chest: false },
        { day: 'mercredi', date: '2026-05-14', chest: true },
        COUNTERS,
      ),
    ).toEqual(['Caisses (mercredi (2026-05-14)) : non → oui']);
  });

  it('formats creation with empty previous values', () => {
    expect(formatHistoryValueChanges('CREATE', null, baseSnapshot, COUNTERS)).toEqual([
      'Nom affiché : — → Dr. House',
      'Caisses : — → ·······',
      'Présences : — → ·······',
      'Patients : — → 0',
      'Shérifs : — → 0',
      'Infusions : — → 0',
      'Lait de pavot : — → 0',
    ]);
  });

  it('formats deletion with empty next values', () => {
    expect(formatHistoryValueChanges('DELETE', baseSnapshot, null, COUNTERS)).toEqual([
      'Nom affiché : Dr. House → —',
      'Caisses : ······· → —',
      'Présences : ······· → —',
      'Patients : 0 → —',
      'Shérifs : 0 → —',
      'Infusions : 0 → —',
      'Lait de pavot : 0 → —',
    ]);
  });

  it('returns empty array when snapshots are invalid', () => {
    expect(formatHistoryValueChanges('UPDATE', null, null, COUNTERS)).toEqual([]);
  });
});
