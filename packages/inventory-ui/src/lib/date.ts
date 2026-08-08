import dayjs from './dayjs';

export function getStartOfDay(date?: Date): Date {
  return dayjs(date).tz().startOf('day').toDate();
}

export function getYesterdayStart(): Date {
  return dayjs.tz().subtract(1, 'day').startOf('day').toDate();
}

export function getDayBeforeYesterdayStart(): Date {
  return dayjs.tz().subtract(2, 'day').startOf('day').toDate();
}

export function formatDate(date: Date): string {
  return dayjs(date).tz().format('YYYY-MM-DD');
}
