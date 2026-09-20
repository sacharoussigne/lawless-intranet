import { describe, expect, it } from 'vitest';
import dayjs from '@/lib/dayjs';
import {
  buildWeekHoursRecap,
  buildWeekHoursRecapBundle,
  eventCalendarDate,
  isParisAfternoonSlot,
  isParisIgnoredMorningSlot,
} from '@/lib/dispensaryWeeklyActivity/weekHoursRecap';

const TZ = 'Europe/Paris';

function parisDate(isoLocal: string): Date {
  return dayjs.tz(isoLocal, 'YYYY-MM-DD HH:mm:ss', TZ).toDate();
}

describe('weekHoursRecap helpers', () => {
  it('ignores 00:01 through 11:59 and keeps 00:00 / 12:00', () => {
    expect(isParisIgnoredMorningSlot(parisDate('2026-05-13 00:00:00'))).toBe(false);
    expect(isParisIgnoredMorningSlot(parisDate('2026-05-13 00:01:00'))).toBe(true);
    expect(isParisIgnoredMorningSlot(parisDate('2026-05-13 11:59:00'))).toBe(true);
    expect(isParisIgnoredMorningSlot(parisDate('2026-05-13 12:00:00'))).toBe(false);
  });

  it('uses calendar day without overnight shift', () => {
    expect(eventCalendarDate(parisDate('2026-05-13 02:00:00'))).toBe('2026-05-13');
    expect(eventCalendarDate(parisDate('2026-05-13 14:00:00'))).toBe('2026-05-13');
  });

  it('detects afternoon inclusive of 12:00 and 20:00', () => {
    expect(isParisAfternoonSlot(parisDate('2026-05-13 11:59:00'))).toBe(false);
    expect(isParisAfternoonSlot(parisDate('2026-05-13 12:00:00'))).toBe(true);
    expect(isParisAfternoonSlot(parisDate('2026-05-13 20:00:00'))).toBe(true);
    expect(isParisAfternoonSlot(parisDate('2026-05-13 20:01:00'))).toBe(false);
  });
});

describe('buildWeekHoursRecap', () => {
  const periodStart = parisDate('2026-05-11 00:00:00'); // Monday
  const activityA = {
    id: 'act-a',
    displayName: 'Alice',
    discordUserId: 'd-a',
    periodStart,
  };
  const activityB = {
    id: 'act-b',
    displayName: 'Bob',
    discordUserId: 'd-b',
    periodStart,
  };

  it('ignores morning presence and patients entirely', () => {
    const days = buildWeekHoursRecap({
      periodStart,
      activities: [activityA],
      history: [
        {
          id: 'h1',
          activityId: 'act-a',
          action: 'UPDATE_PRESENCE_DAYS',
          createdAt: parisDate('2026-05-12 08:00:00'),
          previousValues: { day: 'mardi', date: '2026-05-12', presence: false },
          nextValues: { day: 'mardi', date: '2026-05-12', presence: true },
        },
        {
          id: 'h2',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 09:00:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
      ],
    });
    const tuesday = days.find((d) => d.date === '2026-05-12');
    expect(tuesday?.openAt).toBeNull();
    expect(tuesday?.closeAt).toBeNull();
    expect(tuesday?.afternoonPatientsCount).toBeNull();
  });

  it('uses evening presence before evening patient for opening', () => {
    const days = buildWeekHoursRecap({
      periodStart,
      activities: [activityA],
      history: [
        {
          id: 'h1',
          activityId: 'act-a',
          action: 'UPDATE_PRESENCE_DAYS',
          createdAt: parisDate('2026-05-12 20:30:00'),
          previousValues: { day: 'mardi', date: '2026-05-12', presence: false },
          nextValues: { day: 'mardi', date: '2026-05-12', presence: true },
        },
        {
          id: 'h2',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 21:00:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
      ],
    });
    const tuesday = days.find((d) => d.date === '2026-05-12');
    expect(tuesday?.openAt).toBe(parisDate('2026-05-12 20:30:00').toISOString());
    expect(tuesday?.openByName).toBe('Alice');
    expect(tuesday?.openHistoryEntryId).toBe('h1');
    expect(tuesday?.closeHistoryEntryId).toBe('h2');
  });

  it('excludes afternoon patients from opening but counts them', () => {
    const days = buildWeekHoursRecap({
      periodStart,
      activities: [activityA],
      history: [
        {
          id: 'h1',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 14:00:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
        {
          id: 'h2',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 15:30:00'),
          previousValues: { patientsCount: 1 },
          nextValues: { patientsCount: 2 },
        },
      ],
    });
    const tuesday = days.find((d) => d.date === '2026-05-12');
    expect(tuesday?.openAt).toBeNull();
    expect(tuesday?.afternoonPatientsCount).toBe(2);
    expect(tuesday?.closeAt).toBe(parisDate('2026-05-12 15:30:00').toISOString());
  });

  it('ignores afternoon presence for opening', () => {
    const days = buildWeekHoursRecap({
      periodStart,
      activities: [activityA],
      history: [
        {
          id: 'h1',
          activityId: 'act-a',
          action: 'UPDATE_PRESENCE_DAYS',
          createdAt: parisDate('2026-05-12 13:00:00'),
          previousValues: { day: 'mardi', date: '2026-05-12', presence: false },
          nextValues: { day: 'mardi', date: '2026-05-12', presence: true },
        },
      ],
    });
    const tuesday = days.find((d) => d.date === '2026-05-12');
    expect(tuesday?.openAt).toBeNull();
    expect(tuesday?.afternoonPatientsCount).toBeNull();
  });

  it('ignores overnight morning patient and uses 20:01 for open/close after aprem', () => {
    const days = buildWeekHoursRecap({
      periodStart,
      activities: [activityA],
      history: [
        {
          id: 'h1',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-13 02:00:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
        {
          id: 'h2',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 20:00:00'),
          previousValues: { patientsCount: 1 },
          nextValues: { patientsCount: 2 },
        },
        {
          id: 'h3',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 20:01:00'),
          previousValues: { patientsCount: 2 },
          nextValues: { patientsCount: 3 },
        },
      ],
    });
    const tuesday = days.find((d) => d.date === '2026-05-12');
    const wednesday = days.find((d) => d.date === '2026-05-13');
    expect(tuesday?.openAt).toBe(parisDate('2026-05-12 20:01:00').toISOString());
    expect(tuesday?.afternoonPatientsCount).toBe(1);
    expect(tuesday?.closeAt).toBe(parisDate('2026-05-12 20:01:00').toISOString());
    expect(wednesday?.openAt).toBeNull();
    expect(wednesday?.closeAt).toBeNull();
  });

  it('aggregates across doctors and filters by activity set', () => {
    const all = buildWeekHoursRecap({
      periodStart,
      activities: [activityA, activityB],
      history: [
        {
          id: 'h1',
          activityId: 'act-b',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 20:01:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
        {
          id: 'h2',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 21:00:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
      ],
    });
    expect(all.find((d) => d.date === '2026-05-12')?.openByName).toBe('Bob');

    const onlyAlice = buildWeekHoursRecap({
      periodStart,
      activities: [activityA],
      history: [
        {
          id: 'h1',
          activityId: 'act-b',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 20:01:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
        {
          id: 'h2',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 21:00:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
      ],
    });
    expect(onlyAlice.find((d) => d.date === '2026-05-12')?.openByName).toBe('Alice');
  });

  it('exposes per-doctor day breakdown in the bundle', () => {
    const bundle = buildWeekHoursRecapBundle({
      periodStart,
      activities: [activityA, activityB],
      history: [
        {
          id: 'h1',
          activityId: 'act-b',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 20:01:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
        {
          id: 'h2',
          activityId: 'act-a',
          action: 'INCREMENT_PATIENTS',
          createdAt: parisDate('2026-05-12 14:00:00'),
          previousValues: { patientsCount: 0 },
          nextValues: { patientsCount: 1 },
        },
      ],
    });
    expect(bundle.doctors).toHaveLength(2);
    const alice = bundle.doctors.find((d) => d.discordUserId === 'd-a');
    const bob = bundle.doctors.find((d) => d.discordUserId === 'd-b');
    expect(alice?.days.find((d) => d.date === '2026-05-12')?.afternoonPatientsCount).toBe(1);
    expect(alice?.days.find((d) => d.date === '2026-05-12')?.openAt).toBeNull();
    expect(bob?.days.find((d) => d.date === '2026-05-12')?.openByName).toBe('Bob');
  });

  it('ignores intranet UPDATE patient deltas in the morning', () => {
    const days = buildWeekHoursRecap({
      periodStart,
      activities: [activityA],
      history: [
        {
          id: 'h1',
          activityId: 'act-a',
          action: 'UPDATE',
          createdAt: parisDate('2026-05-12 10:00:00'),
          previousValues: {
            displayName: 'Alice',
            discordUserId: 'd-a',
            patientsCount: 2,
            presenceDays: {},
          },
          nextValues: {
            displayName: 'Alice',
            discordUserId: 'd-a',
            patientsCount: 4,
            presenceDays: {},
          },
        },
      ],
    });
    const tuesday = days.find((d) => d.date === '2026-05-12');
    expect(tuesday?.openAt).toBeNull();
    expect(tuesday?.closeAt).toBeNull();
  });
});
