import dayjs from '@/lib/dayjs';

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
