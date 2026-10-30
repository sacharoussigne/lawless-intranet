import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DEFAULT_RP_YEAR_OFFSET } from "@lawless-intranet/types";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Europe/Paris";

/** RP calendar of a scope: display-only, `offset` years before real dates (DB unchanged). */
export type BankRpCalendar = {
  offset: number;
  /** Current RP year, for examples in help texts. */
  currentYear: number;
  /** RP calendar day as a stable Date (UTC noon) for Mantine pickers, from the Paris day of the real instant. */
  toRpDisplayDate: (real: Date) => Date;
  /** Real Paris start-of-day from an RP picker date (local Y-M-D from Mantine). */
  fromRpDisplayDate: (rp: Date) => Date;
  formatRpDay: (value: Date | string) => string;
  formatRpLongDay: (value: Date | string) => string;
};

export function createBankRpCalendar(offset: number = DEFAULT_RP_YEAR_OFFSET): BankRpCalendar {
  const toRpDisplayDate = (real: Date): Date => {
    const paris = dayjs(real).tz(TZ);
    return new Date(Date.UTC(paris.year() - offset, paris.month(), paris.date(), 12, 0, 0));
  };
  return {
    offset,
    currentYear: new Date().getFullYear() - offset,
    toRpDisplayDate,
    fromRpDisplayDate: (rp) => {
      const year = rp.getFullYear() + offset;
      const month = rp.getMonth() + 1;
      const day = rp.getDate();
      const wall = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return dayjs.tz(wall, "YYYY-MM-DD", TZ).startOf("day").toDate();
    },
    formatRpDay: (value) => dayjs(value).tz(TZ).subtract(offset, "year").format("DD/MM/YYYY"),
    formatRpLongDay: (value) =>
      format(toRpDisplayDate(new Date(value)), "d MMMM yyyy", { locale: fr }),
  };
}
