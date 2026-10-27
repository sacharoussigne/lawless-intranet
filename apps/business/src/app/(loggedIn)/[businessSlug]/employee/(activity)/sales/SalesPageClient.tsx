'use client';

import { useMemo, useState } from 'react';
import { Stack } from '@mantine/core';
import { WeekNavigation } from '@/app/_components/WeekNavigation/WeekNavigation';
import {
  addParisWeeks,
  clampParisWeekDateToMax,
  getBankWeekBounds,
  getCurrentParisWeekStart,
} from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';
import { isCurrentBankWeek } from '@/lib/businessWeeklyActivity/weekLock';
import type { WeeklySalesSummary } from '@/app/_actions/sales';
import { EmployeeWeeklySalesDashboard } from '../../EmployeeWeeklySalesDashboard';

type SalesPageClientProps = {
  businessSlug: string;
  canCancel: boolean;
  /** Admin or direction: also edits past weeks (lib/businessWeeklyActivity/weekLock). */
  canDepositOthers: boolean;
  canDelete: boolean;
  sessionUserId: string;
  initialSummary: WeeklySalesSummary;
};

export default function SalesPageClient({
  businessSlug,
  canCancel,
  canDepositOthers,
  canDelete,
  sessionUserId,
  initialSummary,
}: SalesPageClientProps) {
  const currentParisWeekStart = useMemo(() => getCurrentParisWeekStart(), []);
  const [periodWeekDateValue, setPeriodWeekDateValue] = useState<Date>(() =>
    getBankWeekBounds(dayjs().tz('Europe/Paris').startOf('day').toDate()).start,
  );

  const currentWeekBounds = useMemo(
    () => getBankWeekBounds(periodWeekDateValue),
    [periodWeekDateValue],
  );

  return (
    <Stack gap="xl">
      <WeekNavigation
        weekStart={currentWeekBounds.start}
        weekEnd={currentWeekBounds.end}
        weekDateValue={periodWeekDateValue}
        maxWeekStart={currentParisWeekStart}
        onWeekChange={(date) => {
          if (date) {
            setPeriodWeekDateValue(clampParisWeekDateToMax(date, currentParisWeekStart));
          }
        }}
        onPreviousWeek={() => setPeriodWeekDateValue((d) => addParisWeeks(d, -1))}
        onNextWeek={() =>
          setPeriodWeekDateValue((d) =>
            clampParisWeekDateToMax(addParisWeeks(d, 1), currentParisWeekStart),
          )
        }
      />

      <EmployeeWeeklySalesDashboard
        businessSlug={businessSlug}
        canCancel={canCancel}
        canDepositOthers={canDepositOthers}
        canDelete={canDelete}
        canViewAll
        sessionUserId={sessionUserId}
        initialSummary={initialSummary}
        periodWeekDateValue={periodWeekDateValue}
        pageSize={10}
        readOnly={!canDepositOthers && !isCurrentBankWeek(periodWeekDateValue)}
      />
    </Stack>
  );
}
