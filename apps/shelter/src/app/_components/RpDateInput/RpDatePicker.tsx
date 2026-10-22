'use client';

import { DatePicker, DatesProvider, type DatePickerProps } from '@mantine/dates';
import { fromRpDisplayDate, toRpDisplayDate } from '@/lib/rpCalendar';
import 'dayjs/locale/fr';

export type RpDatePickerProps = Omit<
  DatePickerProps<'default'>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> & {
  value: Date | null;
  onChange: (realDate: Date | null) => void;
};

/** Inline calendar showing RP dates; values in and out are real dates (see RpDateInput). */
export function RpDatePicker({ value, onChange, locale = 'fr', defaultDate, ...props }: RpDatePickerProps) {
  const rpValue = value && !Number.isNaN(value.getTime()) ? toRpDisplayDate(value) : null;

  return (
    <DatesProvider settings={{ locale: 'fr', firstDayOfWeek: 1 }}>
      <DatePicker
        {...props}
        locale={locale}
        value={rpValue}
        defaultDate={defaultDate ?? rpValue ?? toRpDisplayDate(new Date())}
        onChange={(rp) => {
          if (rp == null) {
            onChange(null);
            return;
          }
          const next = new Date(rp);
          onChange(Number.isNaN(next.getTime()) ? null : fromRpDisplayDate(next));
        }}
      />
    </DatesProvider>
  );
}
