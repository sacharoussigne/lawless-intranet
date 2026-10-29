import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));

const { raisesWeeklyCounter } = await import('@/lib/businessWeeklyActivity/botCashPreparer');

describe('raisesWeeklyCounter', () => {
  it('detects a counter going up, including one missing before', () => {
    expect(raisesWeeklyCounter({ patients: 2 }, { patients: 3 })).toBe(true);
    expect(raisesWeeklyCounter({}, { sheriffs: 1 })).toBe(true);
  });

  it('allows lowering, keeping or not touching counters', () => {
    expect(raisesWeeklyCounter({ patients: 2 }, { patients: 1 })).toBe(false);
    expect(raisesWeeklyCounter({ patients: 2 }, { patients: 2 })).toBe(false);
    expect(raisesWeeklyCounter({ patients: 2 }, { sheriffs: 0 })).toBe(false);
    expect(raisesWeeklyCounter({ patients: 2 }, undefined)).toBe(false);
  });
});
