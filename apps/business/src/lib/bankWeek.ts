import dayjs from '@/lib/dayjs';

const TZ = 'Europe/Paris';

/**
 * Monday 00:00 → Sunday end-of-day in Europe/Paris (same rule as payroll weeks).
 */
export function getBankWeekBounds(date: Date) {
  const d = dayjs(date).tz(TZ).startOf('day');
  const weekStart = d.subtract((d.day() + 6) % 7, 'day').startOf('day');
  const weekEnd = weekStart.add(6, 'day').endOf('day');
  return { start: weekStart.toDate(), end: weekEnd.toDate() };
}

/**
 * Moves by whole ISO weeks in Paris, independent of the browser timezone.
 */
export function addParisWeeks(date: Date | string | number, deltaWeeks: number): Date {
  const { start: monday } = getBankWeekBounds(new Date(date));
  // Adds calendar days on the Paris date: adding to the instant shifts by an hour across a
  // DST change, which lands back in the same week (the arrows got stuck).
  const parisDay = dayjs(monday).tz(TZ).format('YYYY-MM-DD');
  const targetDay = dayjs(parisDay).add(deltaWeeks * 7, 'day').format('YYYY-MM-DD');
  return dayjs.tz(targetDay, TZ).toDate();
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
