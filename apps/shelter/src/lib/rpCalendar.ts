import { addYears, format, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DEFAULT_RP_YEAR_OFFSET } from '@lawless-intranet/types';

export { DEFAULT_RP_YEAR_OFFSET };

/**
 * RP calendar of a shelter: display-only, `offset` years before real dates (DB unchanged).
 * The offset is a shelter setting (`AppSettings.rpYearOffset`): client code reads it with
 * `useRpCalendar()`, server code with `createRpCalendar(settings.rpYearOffset)`.
 */
export type RpCalendar = {
  offset: number;
  /** Current RP year, for examples in help texts. */
  currentYear: number;
  toRpDisplayDate: (real: Date) => Date;
  fromRpDisplayDate: (rp: Date) => Date;
  formatRpDate: (real: Date | null | undefined, pattern?: string) => string;
};

export function createRpCalendar(offset: number = DEFAULT_RP_YEAR_OFFSET): RpCalendar {
  const toRpDisplayDate = (real: Date): Date => subYears(real, offset);
  return {
    offset,
    currentYear: new Date().getFullYear() - offset,
    toRpDisplayDate,
    fromRpDisplayDate: (rp) => addYears(rp, offset),
    formatRpDate: (real, pattern = 'dd MMMM yyyy') => {
      if (!real) return '—';
      return format(toRpDisplayDate(real), pattern, { locale: fr });
    },
  };
}
