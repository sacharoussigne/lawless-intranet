import { addYears, subYears } from "date-fns";

/** Display-only: RP calendar is 136 years before real dates (DB unchanged). */
export const RP_DISPLAY_YEAR_OFFSET = 136;

export function toRpDisplayDate(real: Date): Date {
  return subYears(real, RP_DISPLAY_YEAR_OFFSET);
}

export function fromRpDisplayDate(rp: Date): Date {
  return addYears(rp, RP_DISPLAY_YEAR_OFFSET);
}
