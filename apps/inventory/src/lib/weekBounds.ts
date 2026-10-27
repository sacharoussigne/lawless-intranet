import dayjs from '@/lib/dayjs';

const TZ = 'Europe/Paris';

export function getWeekBounds(date: Date) {
  const d = dayjs(date).tz(TZ).startOf('day');
  const weekStart = d.subtract((d.day() + 6) % 7, 'day').startOf('day');
  const weekEnd = weekStart.add(6, 'day').endOf('day');
  return { start: weekStart.toDate(), end: weekEnd.toDate() };
}

export const PAST_WEEK_LOCKED_MESSAGE = 'Semaine passée : seule la direction peut la modifier';

/** A sale of a past Paris week is read-only, except for admin and direction (`canEditPastWeeks`). */
export function isPastWeekLocked(createdAt: Date, canEditPastWeeks?: boolean, now: Date = new Date()): boolean {
  return !canEditPastWeeks && createdAt.getTime() < getWeekBounds(now).start.getTime();
}
