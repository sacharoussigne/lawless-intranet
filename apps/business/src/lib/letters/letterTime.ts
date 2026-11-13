import dayjs from '@/lib/dayjs';

/**
 * Time of a letter (RP hour), in Europe/Paris like the rest of the app, so the server and the
 * browser show the same hour. A letter without a time is at midnight (letters saved before it).
 */

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `HH:mm` of the letter. */
export function timeOf(date: Date | string): string {
  return dayjs(date).tz().format('HH:mm');
}

/** False at midnight: no time was given (older letters), so none is shown. */
export function hasTime(date: Date | string): boolean {
  return timeOf(date) !== '00:00';
}

/** The calendar day of `day` (as picked in the date field) at `time` (`HH:mm`, Paris). */
export function withTime(day: Date, time: string): Date {
  const match = TIME.exec(time.trim());
  const [hours, minutes] = match ? [match[1], match[2]] : ['00', '00'];
  const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  return dayjs.tz(`${ymd} ${hours}:${minutes}`, 'Europe/Paris').toDate();
}

/** Now, to the minute: the default date and time of a new letter. */
export function nowToMinute(): Date {
  return dayjs().second(0).millisecond(0).toDate();
}

/**
 * Paris calendar day of the letter, as a local date for `formatRpDate` (date-fns formats in the
 * process timezone, UTC on the server): the day shown matches the time shown, server and browser.
 */
export function letterDay(date: Date | string): Date {
  const paris = dayjs(date).tz();
  return new Date(paris.year(), paris.month(), paris.date());
}
