import { describe, expect, it } from 'vitest';
import { getAgendaCalendarRange } from './calendarRange';

// 15 October 2026, 12:00 in Paris (UTC+2).
const date = new Date('2026-10-15T10:00:00.000Z');

describe('getAgendaCalendarRange', () => {
  it('covers the full weeks of the month in month view', () => {
    expect(getAgendaCalendarRange('month', date)).toEqual({
      // Monday 28 September 2026 00:00 Paris
      rangeStart: '2026-09-27T22:00:00.000Z',
      // Sunday 1 November 2026 23:59:59.999 Paris (UTC+1 after DST change)
      rangeEnd: '2026-11-01T22:59:59.999Z',
    });
  });

  it('covers Monday to Sunday in week view', () => {
    expect(getAgendaCalendarRange('week', date)).toEqual({
      rangeStart: '2026-10-11T22:00:00.000Z',
      rangeEnd: '2026-10-18T21:59:59.999Z',
    });
  });

  it('covers the Paris day in day view', () => {
    expect(getAgendaCalendarRange('day', date)).toEqual({
      rangeStart: '2026-10-14T22:00:00.000Z',
      rangeEnd: '2026-10-15T21:59:59.999Z',
    });
  });

  it('is stable for any time of the same day', () => {
    const morning = getAgendaCalendarRange('month', new Date('2026-10-15T05:00:00.000Z'));
    const evening = getAgendaCalendarRange('month', new Date('2026-10-15T20:00:00.000Z'));
    expect(morning).toEqual(evening);
  });
});
