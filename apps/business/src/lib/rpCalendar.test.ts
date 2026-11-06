import { describe, expect, it } from 'vitest';
import { DEFAULT_RP_YEAR_OFFSET, createRpCalendar } from '@/lib/rpCalendar';

describe('rpCalendar', () => {
  it('converts real dates to RP display and back', () => {
    const { toRpDisplayDate, fromRpDisplayDate } = createRpCalendar();
    const real = new Date('1990-03-15T12:00:00.000Z');
    const rp = toRpDisplayDate(real);
    expect(rp.getUTCFullYear()).toBe(1990 - DEFAULT_RP_YEAR_OFFSET);
    const back = fromRpDisplayDate(rp);
    expect(back.getUTCFullYear()).toBe(1990);
  });

  it('follows the offset of the business', () => {
    const rp = createRpCalendar(100);
    const real = new Date('2026-10-30T12:00:00.000Z');
    expect(rp.formatRpDate(real, 'd MMMM yyyy')).toBe('30 octobre 1926');
    expect(rp.fromRpDisplayDate(rp.toRpDisplayDate(real)).getTime()).toBe(real.getTime());
    expect(rp.currentYear).toBe(new Date().getFullYear() - 100);
  });

  it('computes RP age', () => {
    const { computeRpAge } = createRpCalendar();
    const birthReal = new Date('1990-01-01T00:00:00.000Z');
    const refReal = new Date('2026-01-01T00:00:00.000Z');
    expect(computeRpAge(birthReal, refReal)).toBe(36);
  });
});
