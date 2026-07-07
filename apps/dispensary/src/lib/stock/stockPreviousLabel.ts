import dayjs from '@/lib/dayjs';
import {
  formatDate,
  getDayBeforeYesterdayStart,
  getStartOfDay,
  getYesterdayStart,
} from '@/lib/date';

export function formatLastStockDayLabel(date: Date): string {
  const dateKey = formatDate(getStartOfDay(date));

  if (dateKey === formatDate(getYesterdayStart())) {
    return 'Hier';
  }

  if (dateKey === formatDate(getDayBeforeYesterdayStart())) {
    return 'Avant-hier';
  }

  return dayjs(date).tz().format('DD/MM');
}

export function resolveLastStockDayLabel(
  dates: (Date | null | undefined)[],
  mode: 'newest' | 'oldest',
): string | null {
  const defined = dates.filter((date): date is Date => date != null);
  if (defined.length === 0) {
    return null;
  }

  const selected = defined.reduce((acc, date) => {
    const accTime = getStartOfDay(acc).getTime();
    const dateTime = getStartOfDay(date).getTime();
    if (mode === 'newest') {
      return dateTime > accTime ? date : acc;
    }
    return dateTime < accTime ? date : acc;
  });

  return formatLastStockDayLabel(selected);
}

export function getStockPreviousLabelForDate(date: Date): string {
  const dateKey = formatDate(getStartOfDay(date));

  if (dateKey === formatDate(getYesterdayStart())) {
    return 'Stock hier';
  }

  if (dateKey === formatDate(getDayBeforeYesterdayStart())) {
    return 'Stock avant-hier';
  }

  return 'Stock précédent';
}

export function getStockPreviousColumnLabel(dates: (Date | null | undefined)[]): string {
  const defined = dates.filter((date): date is Date => date != null);
  if (defined.length === 0) {
    return 'Stock précédent';
  }

  const dayKeys = new Set(defined.map((date) => formatDate(getStartOfDay(date))));
  if (dayKeys.size !== 1) {
    return 'Stock précédent';
  }

  return getStockPreviousLabelForDate(defined[0]);
}

export function getStockTotalPreviousLabel(dates: (Date | null | undefined)[]): string {
  return getStockPreviousColumnLabel(dates).replace('Stock ', 'Stock total ');
}
