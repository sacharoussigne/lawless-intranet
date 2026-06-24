'use client';

import { useCallback, useMemo, useState } from 'react';
import { Anchor, Group, SimpleGrid, Stack } from '@mantine/core';
import Link from 'next/link';
import { WeekNavigation } from '@/app/_components/WeekNavigation/WeekNavigation';
import { WeeklyActivityCompactPanel } from '@/app/_components/weeklyActivity/WeeklyActivityCompactPanel';
import { WeeklyActivityCompactTeamList } from '@/app/_components/weeklyActivity/WeeklyActivityCompactTeamList';
import { WeeklyActivityQuickActionsPanel } from '@/app/_components/weeklyActivity/WeeklyActivityQuickActionsPanel';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { EditWeeklyActivityModal } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/EditWeeklyActivityModal';
import { HistoryWeeklyActivityModal } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/HistoryWeeklyActivityModal';
import {
  useWeeklyActivities,
  type WeeklyActivityListItem,
} from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import { addParisWeeks, clampParisWeekDateToMax, getBankWeekBounds, getCurrentParisWeekStart } from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';
import { findOwnWeeklyActivityRow } from '@/lib/dispensaryWeeklyActivity/findOwnRow';
import { weeklyActivityFieldVisibilityFromSettings } from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import {
  isSameWeeklyActivityWeek,
  type WeeklyActivityWeekBounds,
} from '@/lib/dispensaryWeeklyActivity/queryKeys';
import { tenantRoutes } from '@/types/routes';

function canEditWeeklyRow(
  row: WeeklyActivityListItem,
  canEdit: boolean,
  canEditAll: boolean,
  sessionUserId: string,
  viewerDiscordId: string | null,
): boolean {
  if (!canEdit) return false;
  if (canEditAll) return true;
  if (viewerDiscordId && row.discordUserId === viewerDiscordId) return true;
  if (row.userId === sessionUserId) return true;
  return false;
}

type EmployeeWeeklyDashboardProps = {
  dispensarySlug: string;
  canEdit: boolean;
  canEditAll: boolean;
  sessionUserId: string;
  viewerDiscordId: string | null;
  defaultDisplayName: string;
  initialWeekBounds: WeeklyActivityWeekBounds;
  initialRows: WeeklyActivityListItem[];
};

export function EmployeeWeeklyDashboard({
  dispensarySlug,
  canEdit,
  canEditAll,
  sessionUserId,
  viewerDiscordId,
  defaultDisplayName,
  initialWeekBounds,
  initialRows,
}: EmployeeWeeklyDashboardProps) {
  const { appSettings } = usePermissions();
  const fieldVisibility = useMemo(
    () => weeklyActivityFieldVisibilityFromSettings(appSettings),
    [appSettings],
  );

  const [editRow, setEditRow] = useState<WeeklyActivityListItem | null>(null);
  const [historyActivityId, setHistoryActivityId] = useState<string | null>(null);
  const [historyTitle, setHistoryTitle] = useState('');
  const [periodWeekDateValue, setPeriodWeekDateValue] = useState<Date>(() =>
    getBankWeekBounds(dayjs().tz('Europe/Paris').startOf('day').toDate()).start,
  );

  const currentWeekBounds = useMemo(
    () => getBankWeekBounds(periodWeekDateValue),
    [periodWeekDateValue],
  );

  const queryWeekBounds = useMemo(
    (): WeeklyActivityWeekBounds => ({
      periodStart: currentWeekBounds.start,
      periodEnd: currentWeekBounds.end,
    }),
    [currentWeekBounds],
  );

  const { data: fetchedRows = [], isFetching } = useWeeklyActivities(queryWeekBounds, {
    bounds: initialWeekBounds,
    rows: initialRows,
  });

  const rows = useMemo(() => {
    if (fetchedRows.length > 0) return fetchedRows;
    if (isSameWeeklyActivityWeek(initialWeekBounds, queryWeekBounds)) {
      return initialRows;
    }
    return fetchedRows;
  }, [fetchedRows, initialRows, initialWeekBounds, queryWeekBounds]);

  const ownRow = useMemo(
    () => findOwnWeeklyActivityRow(rows, sessionUserId, viewerDiscordId),
    [rows, sessionUserId, viewerDiscordId],
  );

  const teamRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.resolvedDisplayName.localeCompare(b.resolvedDisplayName, 'fr', { sensitivity: 'base' }),
      ),
    [rows],
  );

  const canEditRow = useCallback(
    (row: WeeklyActivityListItem) =>
      canEditWeeklyRow(row, canEdit, canEditAll, sessionUserId, viewerDiscordId),
    [canEdit, canEditAll, sessionUserId, viewerDiscordId],
  );

  const currentParisWeekStart = useMemo(() => getCurrentParisWeekStart(), []);

  const weeklyActivityHref = tenantRoutes(dispensarySlug).weeklyActivity.index;

  return (
    <>
      <Stack gap="lg" mt="xl">
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
            loading={isFetching}
          />
          <Anchor component={Link} href={weeklyActivityHref} size="sm" c="dimmed">
            Détail complet
          </Anchor>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <WeeklyActivityQuickActionsPanel
            row={ownRow}
            fieldVisibility={fieldVisibility}
            weekBounds={queryWeekBounds}
            hasDiscord={viewerDiscordId !== null}
            canEdit={canEdit}
          />
          <WeeklyActivityCompactPanel
            displayName={ownRow?.resolvedDisplayName ?? defaultDisplayName}
            row={ownRow}
            fieldVisibility={fieldVisibility}
            canEdit={ownRow ? canEditRow(ownRow) : false}
            onEdit={() => ownRow && setEditRow(ownRow)}
          />
        </SimpleGrid>

        {canEditAll && (
          <WeeklyActivityCompactTeamList
            rows={teamRows}
            fieldVisibility={fieldVisibility}
            canEditRow={canEditRow}
            onEdit={setEditRow}
            onHistory={(row) => {
              setHistoryActivityId(row.id);
              setHistoryTitle(row.resolvedDisplayName);
            }}
          />
        )}
      </Stack>

      <EditWeeklyActivityModal
        row={editRow}
        onClose={() => setEditRow(null)}
        canEditAll={canEditAll}
        fieldVisibility={fieldVisibility}
        weekBounds={queryWeekBounds}
      />

      <HistoryWeeklyActivityModal
        activityId={historyActivityId}
        title={historyTitle}
        onClose={() => setHistoryActivityId(null)}
      />
    </>
  );
}
