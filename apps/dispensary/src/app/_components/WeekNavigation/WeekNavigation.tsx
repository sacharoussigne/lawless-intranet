'use client';

import { ActionIcon, Button, Group, Stack, Text } from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { formatDate, parsePickerDate } from '@/lib/date';
import {
  getBankWeekBounds,
  getCurrentParisWeekStart,
  isParisWeekAfter,
} from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';
import { fromRpDisplayDate, toRpDisplayDate } from '@/lib/rpCalendar';

interface WeekNavigationProps {
  weekStart: Date;
  weekEnd: Date;
  weekDateValue: Date | null;
  onWeekChange: (date: Date | null) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  loading?: boolean;
  /** Latest selectable week (Monday, Europe/Paris). Blocks future weeks in picker and next button. */
  maxWeekStart?: Date;
  /** Display and pick dates in RP calendar (−136 years). Stored/emitted dates stay real. */
  useRpCalendar?: boolean;
}

export function WeekNavigation({
  weekStart,
  weekEnd,
  weekDateValue,
  onWeekChange,
  onPreviousWeek,
  onNextWeek,
  loading = false,
  maxWeekStart,
  useRpCalendar = false,
}: WeekNavigationProps) {
  const displayStart = useRpCalendar ? toRpDisplayDate(weekStart) : weekStart;
  const displayEnd = useRpCalendar ? toRpDisplayDate(weekEnd) : weekEnd;
  const weekRange = `${dayjs(displayStart).tz('Europe/Paris').format('D MMM')} - ${dayjs(displayEnd).tz('Europe/Paris').format('D MMM YYYY')}`;

  const pickerValue = weekDateValue
    ? formatDate(useRpCalendar ? toRpDisplayDate(weekDateValue) : weekDateValue)
    : null;
  const maxWeekBounds = maxWeekStart ? getBankWeekBounds(maxWeekStart) : null;
  const pickerMaxDate = maxWeekBounds
    ? useRpCalendar
      ? toRpDisplayDate(maxWeekBounds.end)
      : maxWeekBounds.end
    : undefined;
  const isAtMaxWeek =
    maxWeekBounds != null && weekStart.getTime() >= maxWeekBounds.start.getTime();
  const currentWeekStart = maxWeekStart ?? getCurrentParisWeekStart();
  const isCurrentWeek =
    getBankWeekBounds(weekStart).start.getTime() ===
    getBankWeekBounds(currentWeekStart).start.getTime();

  const picker = (width: number | string) => (
    <DatePickerInput
      value={pickerValue}
      onChange={(date) => {
        const parsed = parsePickerDate(date as Date | string | null);
        if (!parsed) {
          onWeekChange(null);
          return;
        }
        const realDate = useRpCalendar ? fromRpDisplayDate(parsed) : parsed;
        if (maxWeekStart && isParisWeekAfter(realDate, maxWeekStart)) {
          return;
        }
        onWeekChange(realDate);
      }}
      placeholder="Sélectionner le lundi"
      valueFormat="D MMMM YYYY"
      style={{ width }}
      clearable={false}
      radius="md"
      size="sm"
      maxDate={pickerMaxDate}
    />
  );
  const previousButton = (size: 'md' | 'lg') => (
    <ActionIcon variant="light" onClick={onPreviousWeek} disabled={loading} size={size} radius="md" aria-label="Semaine précédente">
      <IconChevronLeft size={18} />
    </ActionIcon>
  );
  const nextButton = (size: 'md' | 'lg') => (
    <ActionIcon
      variant="light"
      onClick={onNextWeek}
      disabled={loading || isAtMaxWeek}
      size={size}
      radius="md"
      aria-label="Semaine suivante"
    >
      <IconChevronRight size={18} />
    </ActionIcon>
  );
  const todayButton = (
    <Button
      size="compact-sm"
      variant="light"
      disabled={loading || isCurrentWeek}
      onClick={() => onWeekChange(currentWeekStart)}
    >
      Aujourd&apos;hui
    </Button>
  );

  return (
    <DatesProvider settings={{ locale: 'fr' }}>
      <Group align="center" wrap="nowrap" gap="md" visibleFrom="sm">
        {previousButton('md')}
        <Group gap="xs" align="center">
          <Text size="sm" fw={500} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            Semaine du
          </Text>
          {picker(180)}
        </Group>
        {nextButton('md')}
        {todayButton}
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <Text size="xs" c="dimmed" mb={2}>
            Période
          </Text>
          <Text size="sm" fw={500}>
            {weekRange}
          </Text>
        </div>
      </Group>

      {/* Phones: period between the arrows, picker and « Aujourd'hui » underneath. */}
      <Stack gap="xs" hiddenFrom="sm">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          {previousButton('lg')}
          <Text fw={600} ta="center" style={{ flex: 1, minWidth: 0 }}>
            {weekRange}
          </Text>
          {nextButton('lg')}
        </Group>
        <Group wrap="nowrap" gap="sm">
          <div style={{ flex: 1, minWidth: 0 }}>{picker('100%')}</div>
          {todayButton}
        </Group>
      </Stack>
    </DatesProvider>
  );
}
