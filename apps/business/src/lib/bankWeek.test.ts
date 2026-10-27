import { describe, expect, it } from 'vitest';
import { addParisWeeks, getBankWeekBounds } from './bankWeek';

const parisMonday = (date: Date) => getBankWeekBounds(date).start.toISOString();

describe('addParisWeeks', () => {
  it('crosses the switch to winter time (25 Oct 2026)', () => {
    const before = getBankWeekBounds(new Date('2026-10-20T10:00:00Z')).start;
    expect(parisMonday(addParisWeeks(before, 1))).toBe('2026-10-25T23:00:00.000Z');
    expect(parisMonday(addParisWeeks(addParisWeeks(before, 1), -1))).toBe('2026-10-18T22:00:00.000Z');
  });

  it('crosses the switch to summer time (29 Mar 2026)', () => {
    const before = getBankWeekBounds(new Date('2026-03-24T10:00:00Z')).start;
    expect(parisMonday(addParisWeeks(before, 1))).toBe('2026-03-29T22:00:00.000Z');
    expect(parisMonday(addParisWeeks(addParisWeeks(before, 1), -1))).toBe('2026-03-22T23:00:00.000Z');
  });
});
