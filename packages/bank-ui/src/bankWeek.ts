import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Europe/Paris';

export function getBankWeekBounds(date: Date) {
  const d = dayjs(date).tz(TZ).startOf('day');
  const weekStart = d.subtract((d.day() + 6) % 7, 'day').startOf('day');
  const weekEnd = weekStart.add(6, 'day').endOf('day');
  return { start: weekStart.toDate(), end: weekEnd.toDate() };
}

export function addParisWeeks(date: Date | string | number, deltaWeeks: number): Date {
  const { start: monday } = getBankWeekBounds(new Date(date));
  return dayjs(monday).tz(TZ).add(deltaWeeks, 'week').toDate();
}

export function getCurrentParisWeekStart(): Date {
  return getBankWeekBounds(new Date()).start;
}

export function clampParisWeekDateToMax(date: Date, maxWeekStart: Date): Date {
  const monday = getBankWeekBounds(date).start;
  const maxMonday = getBankWeekBounds(maxWeekStart).start;
  return monday.getTime() > maxMonday.getTime() ? maxMonday : monday;
}

export function isParisWeekAfter(date: Date, maxWeekStart: Date): boolean {
  return getBankWeekBounds(date).start.getTime() > getBankWeekBounds(maxWeekStart).start.getTime();
}
