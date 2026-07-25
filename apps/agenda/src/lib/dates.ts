import dayjs from '@/lib/dayjs';

export function parseAgendaDateInput(
  dateStr: string,
  timeStr: string | undefined,
  allDay: boolean,
): Date {
  if (allDay) {
    return dayjs.tz(dateStr, 'Europe/Paris').startOf('day').toDate();
  }
  const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr;
  return dayjs.tz(combined, 'Europe/Paris').toDate();
}

export function parseAgendaEndDateInput(
  dateStr: string,
  timeStr: string | undefined,
  allDay: boolean,
): Date {
  if (allDay) {
    return dayjs.tz(dateStr, 'Europe/Paris').endOf('day').toDate();
  }
  const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr;
  return dayjs.tz(combined, 'Europe/Paris').toDate();
}

export function assertAgendaEventRangeValid(
  startAt: Date,
  endAt: Date,
  allDay: boolean,
): void {
  if (allDay) return;
  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error('La fin doit être après le début');
  }
}
