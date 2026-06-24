import { describe, expect, it } from 'vitest';
import { emptyWeekdayFlags } from '@/lib/dispensaryWeeklyActivity/weekdayFlags';
import { formatHistoryValueChanges } from '@/lib/dispensaryWeeklyActivity/historyValueDiff';

const baseSnapshot = {
  periodStart: '2026-05-11T00:00:00.000Z',
  periodEnd: '2026-05-17T23:59:59.999Z',
  displayName: 'Dr. House',
  discordUserId: '123',
  userId: null,
  chestDays: emptyWeekdayFlags(),
  presenceDays: emptyWeekdayFlags(),
  sherifCount: 0,
  patientsCount: 0,
  infusionsCount: 0,
  poppyMilkCount: 0,
};

describe('formatHistoryValueChanges', () => {
  it('returns changed fields for snapshot updates', () => {
    const previous = {
      ...baseSnapshot,
      patientsCount: 2,
      chestDays: { ...emptyWeekdayFlags(), lundi: true },
    };
    const next = {
      ...baseSnapshot,
      patientsCount: 5,
      chestDays: { ...emptyWeekdayFlags(), lundi: true, mardi: true },
    };

    expect(formatHistoryValueChanges('UPDATE', previous, next)).toEqual([
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
      ),
    ).toEqual(['Caisses (mercredi (2026-05-14)) : non → oui']);
  });

  it('formats creation with empty previous values', () => {
    expect(formatHistoryValueChanges('CREATE', null, baseSnapshot)).toEqual([
      'Nom affiché : — → Dr. House',
      'Caisses : — → ·······',
      'Présences : — → ·······',
      'Shérifs : — → 0',
      'Patients : — → 0',
      'Infusions : — → 0',
      'Lait de pavot : — → 0',
    ]);
  });

  it('formats deletion with empty next values', () => {
    expect(formatHistoryValueChanges('DELETE', baseSnapshot, null)).toEqual([
      'Nom affiché : Dr. House → —',
      'Caisses : ······· → —',
      'Présences : ······· → —',
      'Shérifs : 0 → —',
      'Patients : 0 → —',
      'Infusions : 0 → —',
      'Lait de pavot : 0 → —',
    ]);
  });

  it('returns empty array when snapshots are invalid', () => {
    expect(formatHistoryValueChanges('UPDATE', null, null)).toEqual([]);
  });
});
