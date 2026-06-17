'use client';

import { useEffect, useRef } from 'react';
import { DatePickerInput, type DatePickerInputProps } from '@mantine/dates';
import {
  fromRpDisplayDate,
  getTodayRealDate,
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
  /** When true and value is empty, initializes to today's real date (RP display). */
  defaultToToday?: boolean;
};

export function RpDatePicker({
  value,
  onChange,
  defaultToToday = false,
  ...props
}: RpDatePickerProps) {
  const initializedDefault = useRef(false);
  const realDate =
    typeof value === 'string' ? parseRealDateFromIso(value) : value ?? null;
  const rpToday = toRpDisplayDate(getTodayRealDate());

  useEffect(() => {
    if (!defaultToToday || realDate || initializedDefault.current) return;
    initializedDefault.current = true;
    onChange(getTodayRealDate());
  }, [defaultToToday, realDate, onChange]);

  const rpValue = realDate ? toRpDisplayDate(realDate) : null;

  return (
    <DatePickerInput
      {...props}
      value={rpValue}
      defaultDate={rpToday}
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
