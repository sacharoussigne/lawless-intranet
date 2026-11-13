'use client';

import { DateTimePicker, DatesProvider } from '@mantine/dates';
import 'dayjs/locale/fr';
import { IconCalendarClock } from '@tabler/icons-react';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { letterDay, timeOf, withTime } from '@/lib/letters/letterTime';

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * RP date and time of a letter, in one picker (calendar + hour). The conversation is sorted on
 * them, so a letter added later but written earlier takes its place. One real Date in, one out;
 * the picker shows the RP year and the Paris time.
 */
export function LetterDateTimeInput({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
}) {
  const { offset } = useRpCalendar();
  // « YYYY-MM-DD HH:mm:ss » of the RP day and the Paris time (the picker's string value).
  const rpValue = value
    ? (() => {
        const day = letterDay(value);
        return `${day.getFullYear() - offset}-${pad(day.getMonth() + 1)}-${pad(day.getDate())} ${timeOf(value)}:00`;
      })()
    : null;

  return (
    <DatesProvider settings={{ locale: 'fr', firstDayOfWeek: 1 }}>
      <DateTimePicker
        aria-label="Date et heure de la lettre"
        leftSection={<IconCalendarClock size={16} />}
        valueFormat="DD/MM/YYYY HH:mm"
        value={rpValue}
        onChange={(next) => {
          const match = next ? /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(next) : null;
          if (!match) {
            onChange(null);
            return;
          }
          const [, year, month, dayOfMonth, hours = '00', minutes = '00'] = match;
          const realDay = new Date(Number(year) + offset, Number(month) - 1, Number(dayOfMonth));
          onChange(withTime(realDay, `${hours}:${minutes}`));
        }}
      />
    </DatesProvider>
  );
}
