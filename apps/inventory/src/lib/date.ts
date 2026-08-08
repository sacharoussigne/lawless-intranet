import dayjs from '@/lib/dayjs';

export function getNow(): Date {
  return dayjs.tz().toDate();
}

export function getStartOfDay(date?: Date): Date {
  return dayjs(date).tz().startOf('day').toDate();
}

export function getTodayStart(): Date {
  return dayjs.tz().startOf('day').toDate();
}

export function getYesterdayStart(): Date {
  return dayjs.tz().subtract(1, 'day').startOf('day').toDate();
}

export function getTomorrowStart(): Date {
  return dayjs.tz().add(1, 'day').startOf('day').toDate();
}

export function getDayAfter(date: Date): Date {
  return dayjs(date).tz().add(1, 'day').startOf('day').toDate();
}

export function formatDate(date: Date): string {
  return dayjs(date).tz().format('YYYY-MM-DD');
}

export function parsePickerDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return getStartOfDay(value);
  return dayjs(value).tz().startOf('day').toDate();
}
