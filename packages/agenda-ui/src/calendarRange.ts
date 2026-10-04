import dayjs from './dayjs';

const AGENDA_TIMEZONE = 'Europe/Paris';

export type AgendaCalendarRange = { rangeStart: string; rangeEnd: string };

/**
 * Date range displayed by the calendar for a view, computed in the agenda
 * timezone so server (SSR) and browser produce identical query keys.
 */
export function getAgendaCalendarRange(view: string, date: Date): AgendaCalendarRange {
  const day = dayjs(date).tz(AGENDA_TIMEZONE);

  let start;
  let end;
  switch (view) {
    case 'day':
      start = day.startOf('day');
      end = day.endOf('day');
      break;
    case 'week':
    case 'work_week':
      start = day.startOf('isoWeek');
      end = day.endOf('isoWeek');
      break;
    case 'agenda':
      start = day.startOf('day');
      end = day.add(30, 'day').endOf('day');
      break;
    default:
      start = day.startOf('month').startOf('isoWeek');
      end = day.endOf('month').endOf('isoWeek');
      break;
  }

  return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
}
