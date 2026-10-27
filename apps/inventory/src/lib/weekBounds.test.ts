import { describe, expect, it } from 'vitest';
import { isPastWeekLocked } from './weekBounds';

// Wednesday 2026-10-28, noon in Paris; the week starts on Monday 2026-10-26 in Paris.
const NOW = new Date('2026-10-28T11:00:00Z');

describe('isPastWeekLocked', () => {
  it('locks a sale of a past week', () => {
    expect(isPastWeekLocked(new Date('2026-10-25T21:00:00Z'), false, NOW)).toBe(true);
  });

  it('keeps the current week open', () => {
    expect(isPastWeekLocked(new Date('2026-10-25T23:30:00Z'), false, NOW)).toBe(false);
  });

  it('lets admin and direction touch past weeks', () => {
    expect(isPastWeekLocked(new Date('2026-10-20T10:00:00Z'), true, NOW)).toBe(false);
  });
});
