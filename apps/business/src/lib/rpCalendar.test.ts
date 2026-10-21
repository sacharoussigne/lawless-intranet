import { describe, expect, it } from 'vitest';
import {
  RP_DISPLAY_YEAR_OFFSET,
  computeRpAge,
  fromRpDisplayDate,
  toRpDisplayDate,
} from '@/lib/rpCalendar';

describe('rpCalendar', () => {
  it('converts real dates to RP display and back', () => {
    const real = new Date('1990-03-15T12:00:00.000Z');
    const rp = toRpDisplayDate(real);
    expect(rp.getUTCFullYear()).toBe(1990 - RP_DISPLAY_YEAR_OFFSET);
    const back = fromRpDisplayDate(rp);
    expect(back.getUTCFullYear()).toBe(1990);
  });

  it('computes RP age', () => {
    const birthReal = new Date('1990-01-01T00:00:00.000Z');
    const refReal = new Date('2026-01-01T00:00:00.000Z');
    const age = computeRpAge(birthReal, refReal);
    expect(age).toBe(36);
  });
});
