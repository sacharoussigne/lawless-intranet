import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStartOfDay } from '@/lib/date';
import {
  formatLastStockDayLabel,
  getStockPreviousColumnLabel,
  getStockPreviousLabelForDate,
  getStockTotalPreviousLabel,
  resolveLastStockDayLabel,
} from './stockPreviousLabel';

describe('stockPreviousLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Stock hier for yesterday', () => {
    expect(getStockPreviousLabelForDate(getStartOfDay(new Date('2026-06-11T08:00:00.000Z')))).toBe('Stock hier');
  });

  it('returns Stock avant-hier for the day before yesterday', () => {
    expect(getStockPreviousLabelForDate(getStartOfDay(new Date('2026-06-10T08:00:00.000Z')))).toBe('Stock avant-hier');
  });

  it('returns Stock précédent for older dates', () => {
    expect(getStockPreviousLabelForDate(getStartOfDay(new Date('2026-06-08T08:00:00.000Z')))).toBe('Stock précédent');
  });

  it('uses a specific label when all dates match the same day', () => {
    const date = getStartOfDay(new Date('2026-06-11T08:00:00.000Z'));
    expect(getStockPreviousColumnLabel([date, date])).toBe('Stock hier');
  });

  it('falls back to Stock précédent when dates differ', () => {
    expect(
      getStockPreviousColumnLabel([
        getStartOfDay(new Date('2026-06-11T08:00:00.000Z')),
        getStartOfDay(new Date('2026-06-10T08:00:00.000Z')),
      ]),
    ).toBe('Stock précédent');
  });

  it('falls back to Stock précédent when no dates are provided', () => {
    expect(getStockPreviousColumnLabel([null, undefined])).toBe('Stock précédent');
  });

  it('builds total labels from stock labels', () => {
    expect(getStockTotalPreviousLabel([getStartOfDay(new Date('2026-06-11T08:00:00.000Z'))])).toBe('Stock total hier');
  });

  it('formats last stock day as Hier', () => {
    expect(formatLastStockDayLabel(getStartOfDay(new Date('2026-06-11T08:00:00.000Z')))).toBe('Hier');
  });

  it('formats last stock day as Avant-hier', () => {
    expect(formatLastStockDayLabel(getStartOfDay(new Date('2026-06-10T08:00:00.000Z')))).toBe('Avant-hier');
  });

  it('formats last stock day as DD/MM for older dates', () => {
    expect(formatLastStockDayLabel(getStartOfDay(new Date('2026-06-08T08:00:00.000Z')))).toBe('08/06');
  });

  it('resolves newest last stock day label', () => {
    expect(
      resolveLastStockDayLabel(
        [
          getStartOfDay(new Date('2026-06-08T08:00:00.000Z')),
          getStartOfDay(new Date('2026-06-11T08:00:00.000Z')),
        ],
        'newest',
      ),
    ).toBe('Hier');
  });

  it('returns null when no dates are provided to resolveLastStockDayLabel', () => {
    expect(resolveLastStockDayLabel([null, undefined], 'newest')).toBeNull();
  });
});
