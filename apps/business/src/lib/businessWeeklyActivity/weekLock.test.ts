import { describe, expect, it } from 'vitest';
import { canEditPastWeeks, isCurrentBankWeek, isWeekLocked } from './weekLock';

// Wednesday 2026-10-28, noon in Paris.
const NOW = new Date('2026-10-28T11:00:00Z');

describe('weekLock', () => {
  it('knows the current Paris bank week', () => {
    expect(isCurrentBankWeek(new Date('2026-10-26T08:00:00Z'), NOW)).toBe(true);
    expect(isCurrentBankWeek(new Date('2026-11-01T20:00:00Z'), NOW)).toBe(true);
    expect(isCurrentBankWeek(new Date('2026-10-25T20:00:00Z'), NOW)).toBe(false);
  });

  it('lets admin and direction edit past weeks', () => {
    expect(canEditPastWeeks('admin')).toBe(true);
    expect(canEditPastWeeks('direction,employee')).toBe(true);
    expect(canEditPastWeeks('employee')).toBe(false);
    expect(canEditPastWeeks(null)).toBe(false);
  });

  it('locks a past week only for the other roles', () => {
    const lastWeek = new Date('2026-10-20T10:00:00Z');
    expect(isWeekLocked(lastWeek, 'employee', NOW)).toBe(true);
    expect(isWeekLocked(lastWeek, 'direction', NOW)).toBe(false);
    expect(isWeekLocked(NOW, 'employee', NOW)).toBe(false);
  });
});
