'use client';

import { ActionIcon, Group, Text } from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { formatDate, parsePickerDate } from '@/lib/date';
import { getBankWeekBounds, isParisWeekAfter } from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';

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
}: WeekNavigationProps) {
  const weekRange = `${dayjs(weekStart).tz('Europe/Paris').format('D MMM')} - ${dayjs(weekEnd).tz('Europe/Paris').format('D MMM YYYY')}`;
  const pickerValue = weekDateValue ? formatDate(weekDateValue) : null;
  const maxWeekBounds = maxWeekStart ? getBankWeekBounds(maxWeekStart) : null;
  const isAtMaxWeek =
    maxWeekBounds != null && weekStart.getTime() >= maxWeekBounds.start.getTime();

  return (
    <DatesProvider settings={{ locale: 'fr' }}>
      <Group align="center" wrap="nowrap" gap="md">
        <ActionIcon
          variant="light"
          onClick={onPreviousWeek}
          disabled={loading}
          size="md"
          radius="md"
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Group gap="xs" align="center">
          <Text size="sm" fw={500} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            Semaine du
          </Text>
          <DatePickerInput
            value={pickerValue}
            onChange={(date) => {
              const parsed = parsePickerDate(date as Date | string | null);
              if (!parsed) {
                onWeekChange(null);
                return;
              }
              if (maxWeekStart && isParisWeekAfter(parsed, maxWeekStart)) {
                return;
              }
              onWeekChange(parsed);
            }}
            placeholder="Sélectionner le lundi"
            valueFormat="D MMMM YYYY"
            style={{ width: 180 }}
            clearable={false}
            radius="md"
            size="sm"
            maxDate={maxWeekBounds?.end}
          />
        </Group>
        <ActionIcon
          variant="light"
          onClick={onNextWeek}
          disabled={loading || isAtMaxWeek}
          size="md"
          radius="md"
        >
          <IconChevronRight size={18} />
        </ActionIcon>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <Text size="xs" c="dimmed" mb={2}>
            Période
          </Text>
          <Text size="sm" fw={500}>
            {weekRange}
          </Text>
        </div>
      </Group>
    </DatesProvider>
  );
}
