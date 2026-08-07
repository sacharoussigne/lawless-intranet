'use client';

import { DateInput, DatesProvider, type DateInputProps } from '@mantine/dates';
import 'dayjs/locale/fr';
import {
  fromRpDisplayDate,
  getTodayRealDate,
  parseRealDateFromIso,
  toRpDisplayDate,
} from '@/lib/rpCalendar';

export type RpDateInputProps = Omit<DateInputProps, 'value' | 'onChange' | 'defaultValue'> & {
  /** Real date stored in DB (ISO / Date). Displayed in RP calendar in the input. */
  value: Date | string | null;
  onChange: (realDate: Date | null) => void;
};

export function RpDateInput({ value, onChange, valueFormat = 'DD/MM/YYYY', ...props }: RpDateInputProps) {
  const realDate =
    typeof value === 'string' ? parseRealDateFromIso(value) : value ?? null;
  const rpValue = realDate ? toRpDisplayDate(realDate) : null;
  const rpToday = toRpDisplayDate(getTodayRealDate());

  return (
    <DatesProvider settings={{ locale: 'fr', firstDayOfWeek: 1 }}>
      <DateInput
        {...props}
        value={rpValue}
        defaultDate={rpToday}
        valueFormat={valueFormat}
        onChange={(rp) => {
          if (rp == null) {
            onChange(null);
            return;
          }
          const next = new Date(rp);
          if (Number.isNaN(next.getTime())) {
            onChange(null);
            return;
          }
          onChange(fromRpDisplayDate(next));
        }}
      />
    </DatesProvider>
  );
}
