"use client";

import { DateInput, type DateInputProps } from "@mantine/dates";
import { useBankUi } from "../BankUiProvider";

export type RpDateInputProps = Omit<
  DateInputProps,
  "value" | "onChange" | "defaultValue"
> & {
  value: Date | string | null | undefined;
  onChange: (realDate: Date | null) => void;
};

function toRealDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function RpDateInput({
  value,
  onChange,
  valueFormat = "DD/MM/YYYY",
  locale = "fr",
  ...props
}: RpDateInputProps) {
  const { rp } = useBankUi();
  const { fromRpDisplayDate, toRpDisplayDate } = rp;
  const realDate = toRealDate(value);
  const rpValue = realDate ? toRpDisplayDate(realDate) : null;

  return (
    <DateInput
      {...props}
      locale={locale}
      valueFormat={valueFormat}
      value={rpValue}
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
  );
}
