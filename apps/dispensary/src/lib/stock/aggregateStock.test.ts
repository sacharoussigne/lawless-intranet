import { describe, expect, it } from 'vitest';
import { getStartOfDay } from '@/lib/date';
import { aggregateTodayYesterday, aggregateTodayAndPrevious } from './aggregateStock';

describe('aggregateTodayYesterday', () => {
  const today = new Date('2026-06-12T12:00:00.000Z');
  const yesterday = new Date('2026-06-11T12:00:00.000Z');

  it('aggregates per chest when chestId is provided', () => {
    const rows = [
      {
        itemId: 'item-1',
        chestId: 'chest-a',
        quantity: 5,
        timestamp: new Date('2026-06-12T08:00:00.000Z'),
      },
      {
        itemId: 'item-1',
        chestId: 'chest-a',
        quantity: 3,
        timestamp: new Date('2026-06-11T08:00:00.000Z'),
      },
    ];

    const result = aggregateTodayYesterday(rows, today, yesterday, 'chest-a');
    expect(result.get('item-1')).toEqual({
      stockToday: 5,
      stockYesterday: 3,
      stockPreviousAt: getStartOfDay(new Date('2026-06-11T08:00:00.000Z')),
    });
  });

  it('sums across chests when chestId is omitted', () => {
    const rows = [
      {
        itemId: 'item-1',
        chestId: 'chest-a',
        quantity: 2,
        timestamp: new Date('2026-06-12T08:00:00.000Z'),
      },
      {
        itemId: 'item-1',
        chestId: 'chest-b',
        quantity: 3,
        timestamp: new Date('2026-06-12T09:00:00.000Z'),
      },
    ];

    const result = aggregateTodayYesterday(rows, today, yesterday);
    expect(result.get('item-1')).toEqual({
      stockToday: 5,
      stockYesterday: null,
      stockPreviousAt: null,
    });
  });
});

describe('aggregateTodayAndPrevious', () => {
  const today = new Date('2026-06-12T12:00:00.000Z');

  it('uses last known stock when calendar yesterday is missing', () => {
    const todayRows = [
      {
        itemId: 'item-1',
        chestId: 'chest-a',
        quantity: 202,
        timestamp: new Date('2026-06-12T08:00:00.000Z'),
      },
    ];
    const previousRows = [
      {
        itemId: 'item-1',
        chestId: 'chest-a',
        quantity: 200,
        timestamp: new Date('2026-06-10T08:00:00.000Z'),
      },
    ];

    const result = aggregateTodayAndPrevious(todayRows, previousRows, today, 'chest-a');
    expect(result.get('item-1')).toEqual({
      stockToday: 202,
      stockYesterday: 200,
      stockPreviousAt: getStartOfDay(new Date('2026-06-10T08:00:00.000Z')),
    });
  });

  it('returns null previous stock when item was never inventoried', () => {
    const todayRows = [
      {
        itemId: 'item-1',
        chestId: 'chest-a',
        quantity: 5,
        timestamp: new Date('2026-06-12T08:00:00.000Z'),
      },
    ];

    const result = aggregateTodayAndPrevious(todayRows, [], today, 'chest-a');
    expect(result.get('item-1')).toEqual({
      stockToday: 5,
      stockYesterday: null,
      stockPreviousAt: null,
    });
  });

  it('sums previous stock across chests when chestId is omitted', () => {
    const previousRows = [
      {
        itemId: 'item-1',
        chestId: 'chest-a',
        quantity: 10,
        timestamp: new Date('2026-06-10T08:00:00.000Z'),
      },
      {
        itemId: 'item-1',
        chestId: 'chest-b',
        quantity: 15,
        timestamp: new Date('2026-06-09T08:00:00.000Z'),
      },
    ];

    const result = aggregateTodayAndPrevious([], previousRows, today);
    expect(result.get('item-1')).toEqual({
      stockToday: null,
      stockYesterday: 25,
      stockPreviousAt: null,
    });
  });

  it('exposes previous stock even when today has no entry yet', () => {
    const previousRows = [
      {
        itemId: 'item-1',
        chestId: 'chest-a',
        quantity: 42,
        timestamp: new Date('2026-06-10T08:00:00.000Z'),
      },
    ];

    const result = aggregateTodayAndPrevious([], previousRows, today, 'chest-a');
    expect(result.get('item-1')).toEqual({
      stockToday: null,
      stockYesterday: 42,
      stockPreviousAt: getStartOfDay(new Date('2026-06-10T08:00:00.000Z')),
    });
  });
});
