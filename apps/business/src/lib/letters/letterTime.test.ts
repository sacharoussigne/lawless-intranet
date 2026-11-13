import { describe, expect, it } from 'vitest';
import { hasTime, letterDay, timeOf, withTime } from './letterTime';

describe('letter time', () => {
  it('puts the picked day at the given Paris time', () => {
    const date = withTime(new Date(2026, 10, 13), '14:30');
    expect(date.toISOString()).toBe('2026-11-13T13:30:00.000Z');
    expect(timeOf(date)).toBe('14:30');
  });

  it('follows summer time', () => {
    expect(withTime(new Date(2026, 6, 1), '09:05').toISOString()).toBe('2026-07-01T07:05:00.000Z');
  });

  it('falls back to midnight for an invalid time', () => {
    expect(timeOf(withTime(new Date(2026, 10, 13), '25:99'))).toBe('00:00');
  });

  it('shows no time at midnight (letters saved before)', () => {
    expect(hasTime(withTime(new Date(2026, 10, 13), '00:00'))).toBe(false);
    expect(hasTime(withTime(new Date(2026, 10, 13), '00:01'))).toBe(true);
  });
});

describe('letterDay', () => {
  it('is the Paris calendar day, even late in the evening UTC', () => {
    const day = letterDay(new Date('2026-11-13T23:30:00.000Z'));
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 10, 14]);
  });
});
