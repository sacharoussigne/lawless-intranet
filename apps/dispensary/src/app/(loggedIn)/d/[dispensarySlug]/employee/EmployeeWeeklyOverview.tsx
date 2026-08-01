'use client';

import { useEffect, useMemo, useState } from 'react';
import { Anchor, Group, Stack, Text } from '@mantine/core';
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

const SALES_DETAIL_VISIBLE_STORAGE_KEY = 'employee-home-sales-visible';

function readSalesDetailVisiblePreference(): boolean {
  try {
    const raw = window.localStorage.getItem(SALES_DETAIL_VISIBLE_STORAGE_KEY);
    if (raw == null) return true;
    return JSON.parse(raw) === true;
  } catch {
    return true;
  }
}

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
    canDepositOthers: boolean;
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
  const [salesDetailVisible, setSalesDetailVisible] = useState<boolean | null>(null);

  useEffect(() => {
    setSalesDetailVisible(readSalesDetailVisiblePreference());
  }, []);

  useEffect(() => {
    if (salesDetailVisible == null) return;
    try {
      window.localStorage.setItem(
        SALES_DETAIL_VISIBLE_STORAGE_KEY,
        JSON.stringify(salesDetailVisible),
      );
    } catch {
      // Ignore quota / private mode write failures.
    }
  }, [salesDetailVisible]);

  const currentWeekBounds = useMemo(
    () => getBankWeekBounds(periodWeekDateValue),
    [periodWeekDateValue],
  );

  const weeklyActivityHref = tenantRoutes(dispensarySlug).weeklyActivity.index;
  const preferenceReady = salesDetailVisible != null;

  return (
    <Stack gap="xl" mt="xl" mb="xl">
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

      {showActivity && activity && (
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text className="disp-display-title">Activité hebdo</Text>
            <Anchor component={Link} href={weeklyActivityHref} size="sm" c="dimmed">
              Détail complet
            </Anchor>
          </Group>
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
        </Stack>
      )}

      {showSales && sales && preferenceReady && (
        <EmployeeWeeklySalesDashboard
          dispensarySlug={dispensarySlug}
          canCancel={sales.canCancel}
          canDepositOthers={sales.canDepositOthers}
          canDelete={false}
          canViewAll={sales.canViewAll}
          sessionUserId={sales.sessionUserId}
          initialSummary={sales.initialSummary}
          periodWeekDateValue={periodWeekDateValue}
          pageSize={5}
          detailVisible={salesDetailVisible}
          onDetailVisibleChange={setSalesDetailVisible}
        />
      )}
    </Stack>
  );
}
