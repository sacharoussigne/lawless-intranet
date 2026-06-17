'use client';

import { DatePickerInput, type DatePickerInputProps } from '@mantine/dates';
import {
  fromRpDisplayDate,
  parseRealDateFromIso,
  toRpDisplayDate,
} from '@/lib/rpCalendar';

export type RpDatePickerProps = Omit<
  DatePickerInputProps,
  'value' | 'onChange' | 'defaultValue'
> & {
  /** Real date stored in DB (ISO / Date). Displayed in RP calendar in the picker. */
  value: Date | string | null;
  onChange: (realDate: Date | null) => void;
};

export function RpDatePicker({ value, onChange, ...props }: RpDatePickerProps) {
  const realDate =
    typeof value === 'string' ? parseRealDateFromIso(value) : value ?? null;
  const rpValue = realDate ? toRpDisplayDate(realDate) : null;

  return (
    <DatePickerInput
      {...props}
      value={rpValue}
      onChange={(rp) => {
        if (!rp) {
          onChange(null);
          return;
        }
        onChange(fromRpDisplayDate(new Date(rp)));
      }}
      valueFormat="DD MMMM YYYY"
    />
  );
}
