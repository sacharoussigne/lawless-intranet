import { describe, expect, it } from 'vitest';
import { employmentStatusOf, overlapsPeriod, roleAt, stayConflict } from './periods';

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('overlapsPeriod', () => {
  const week = { from: d('2026-10-19'), to: d('2026-10-25') };

  it('keeps a stay that started before the week and is still open', () => {
    expect(overlapsPeriod({ startedAt: d('2026-01-01'), endedAt: null }, week.from, week.to)).toBe(true);
  });

  it('keeps a stay that ended during the week', () => {
    expect(overlapsPeriod({ startedAt: d('2026-01-01'), endedAt: d('2026-10-21') }, week.from, week.to)).toBe(true);
  });

  it('drops a stay that ended before the week or starts after it', () => {
    expect(overlapsPeriod({ startedAt: d('2026-01-01'), endedAt: d('2026-10-10') }, week.from, week.to)).toBe(false);
    expect(overlapsPeriod({ startedAt: d('2026-10-26'), endedAt: null }, week.from, week.to)).toBe(false);
  });
});

describe('roleAt', () => {
  const events = [
    { occurredAt: d('2026-01-01'), toRole: 'Apprenti' },
    { occurredAt: d('2026-06-01'), toRole: 'Médecin' },
  ];

  it('returns the grade held at that date', () => {
    expect(roleAt(events, d('2026-03-01'))).toBe('Apprenti');
    expect(roleAt(events, d('2026-06-01'))).toBe('Médecin');
    expect(roleAt(events, d('2026-12-01'))).toBe('Médecin');
  });

  it('returns null before the hiring', () => {
    expect(roleAt(events, d('2025-12-01'))).toBeNull();
  });
});

describe('employmentStatusOf', () => {
  it('reports the open stay', () => {
    expect(
      employmentStatusOf([
        { startedAt: d('2026-01-01'), endedAt: d('2026-02-01') },
        { startedAt: d('2026-05-01'), endedAt: null },
      ]),
    ).toEqual({ active: true, since: d('2026-05-01'), leftAt: null, stays: 2 });
  });

  it('reports the last leaving date', () => {
    expect(
      employmentStatusOf([
        { startedAt: d('2026-01-01'), endedAt: d('2026-02-01') },
        { startedAt: d('2026-05-01'), endedAt: d('2026-07-01') },
      ]),
    ).toEqual({ active: false, since: null, leftAt: d('2026-07-01'), stays: 2 });
  });

  it('reports a person never hired', () => {
    expect(employmentStatusOf([])).toEqual({ active: false, since: null, leftAt: null, stays: 0 });
  });
});

describe('stayConflict', () => {
  const stays = [{ startedAt: d('2026-01-01'), endedAt: d('2026-02-01') }];

  it('accepts a new stay after the previous one', () => {
    expect(stayConflict(stays, { startedAt: d('2026-03-01'), endedAt: null })).toBeNull();
  });

  it('refuses a second open stay', () => {
    expect(stayConflict([{ startedAt: d('2026-01-01'), endedAt: null }], { startedAt: d('2026-03-01'), endedAt: null })).toBe(
      'Cette personne est déjà employée.',
    );
  });

  it('refuses overlapping dates and a leaving before the hiring', () => {
    expect(stayConflict(stays, { startedAt: d('2026-01-15'), endedAt: null })).toMatch(/chevauchent/);
    expect(stayConflict([], { startedAt: d('2026-03-01'), endedAt: d('2026-02-01') })).toMatch(/avant/);
  });

  it('ignores the stay being edited', () => {
    expect(stayConflict(stays, { startedAt: d('2026-01-05'), endedAt: d('2026-02-10') }, 0)).toBeNull();
  });
});
