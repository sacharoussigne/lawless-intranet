import { addYears, differenceInYears, format, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Display-only: RP calendar is 136 years before real dates (DB unchanged). */
export const RP_DISPLAY_YEAR_OFFSET = 136;

export function getTodayRealDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toRpDisplayDate(real: Date): Date {
  return subYears(real, RP_DISPLAY_YEAR_OFFSET);
}

export function fromRpDisplayDate(rp: Date): Date {
  return addYears(rp, RP_DISPLAY_YEAR_OFFSET);
}

export function formatRpDate(real: Date | null | undefined, pattern = 'dd MMMM yyyy'): string {
  if (!real) return '—';
  return format(toRpDisplayDate(real), pattern, { locale: fr });
}

export function computeRpAge(
  birthDate: Date | null | undefined,
  referenceReal: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const rpBirth = toRpDisplayDate(birthDate);
  const rpRef = toRpDisplayDate(referenceReal);
  return differenceInYears(rpRef, rpBirth);
}

export function parseRealDateFromIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
