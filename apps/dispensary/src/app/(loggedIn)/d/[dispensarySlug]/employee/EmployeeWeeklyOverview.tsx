'use client';

import { useMemo, useState } from 'react';
import { Anchor, Group, Stack } from '@mantine/core';
import Link from 'next/link';
import { WeekNavigation } from '@/app/_components/WeekNavigation/WeekNavigation';
import {
  addParisWeeks,
  clampParisWeekDateToMax,
  getBankWeekBounds,
  getCurrentParisWeekStart,
} from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';
import { tenantRoutes } from '@/types/routes';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import type { WeeklyActivityWeekBounds } from '@/lib/dispensaryWeeklyActivity/queryKeys';
import type { WeeklySalesSummary } from '@/app/_actions/sales';
import { EmployeeWeeklyDashboard } from './EmployeeWeeklyDashboard';
import { EmployeeWeeklySalesDashboard } from './EmployeeWeeklySalesDashboard';

type EmployeeWeeklyOverviewProps = {
  dispensarySlug: string;
  showActivity: boolean;
  showSales: boolean;
  activity?: {
    canEdit: boolean;
    canEditAll: boolean;
    sessionUserId: string;
    viewerDiscordId: string | null;
    defaultDisplayName: string;
    initialWeekBounds: WeeklyActivityWeekBounds;
    initialRows: WeeklyActivityListItem[];
  };
  sales?: {
    canCancel: boolean;
    canViewAll: boolean;
    sessionUserId: string;
    initialSummary: WeeklySalesSummary;
  };
};

export function EmployeeWeeklyOverview({
  dispensarySlug,
  showActivity,
  showSales,
  activity,
  sales,
}: EmployeeWeeklyOverviewProps) {
  const currentParisWeekStart = useMemo(() => getCurrentParisWeekStart(), []);
  const [periodWeekDateValue, setPeriodWeekDateValue] = useState<Date>(() =>
    getBankWeekBounds(dayjs().tz('Europe/Paris').startOf('day').toDate()).start,
  );

  const currentWeekBounds = useMemo(
    () => getBankWeekBounds(periodWeekDateValue),
    [periodWeekDateValue],
  );

  const weeklyActivityHref = tenantRoutes(dispensarySlug).weeklyActivity.index;

  return (
    <Stack gap="xl" mt="xl" mb="xl">
      <Group justify="space-between" align="flex-end" wrap="wrap">
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
        {showActivity && (
          <Anchor component={Link} href={weeklyActivityHref} size="sm" c="dimmed">
            Détail complet
          </Anchor>
        )}
      </Group>

      {showActivity && activity && (
        <EmployeeWeeklyDashboard
          dispensarySlug={dispensarySlug}
          canEdit={activity.canEdit}
          canEditAll={activity.canEditAll}
          sessionUserId={activity.sessionUserId}
          viewerDiscordId={activity.viewerDiscordId}
          defaultDisplayName={activity.defaultDisplayName}
          initialWeekBounds={activity.initialWeekBounds}
          initialRows={activity.initialRows}
          periodWeekDateValue={periodWeekDateValue}
        />
      )}

      {showSales && sales && (
        <EmployeeWeeklySalesDashboard
          dispensarySlug={dispensarySlug}
          canCancel={sales.canCancel}
          canViewAll={sales.canViewAll}
          sessionUserId={sales.sessionUserId}
          initialSummary={sales.initialSummary}
          periodWeekDateValue={periodWeekDateValue}
        />
      )}
    </Stack>
  );
}
