import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Europe/Paris";

/** Display-only: RP calendar is 136 years before real dates (DB unchanged). */
export const RP_DISPLAY_YEAR_OFFSET = 136;

/**
 * RP calendar day as a stable Date (UTC noon) for Mantine pickers.
 * Derived from the Europe/Paris calendar day of the real instant.
 */
export function toRpDisplayDate(real: Date): Date {
  const paris = dayjs(real).tz(TZ);
  return new Date(
    Date.UTC(
      paris.year() - RP_DISPLAY_YEAR_OFFSET,
      paris.month(),
      paris.date(),
      12,
      0,
      0,
    ),
  );
}

/** Real Paris start-of-day from an RP picker date (local Y-M-D from Mantine). */
export function fromRpDisplayDate(rp: Date): Date {
  const year = rp.getFullYear() + RP_DISPLAY_YEAR_OFFSET;
  const month = rp.getMonth() + 1;
  const day = rp.getDate();
  const wall = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return dayjs.tz(wall, "YYYY-MM-DD", TZ).startOf("day").toDate();
}

export function formatRpDay(value: Date | string): string {
  return dayjs(value)
    .tz(TZ)
    .subtract(RP_DISPLAY_YEAR_OFFSET, "year")
    .format("DD/MM/YYYY");
}

export function formatRpLongDay(value: Date | string): string {
  return format(toRpDisplayDate(new Date(value)), "d MMMM yyyy", { locale: fr });
}
