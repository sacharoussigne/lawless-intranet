'use client';

import { useCallback, useMemo, useState } from 'react';
import { SimpleGrid, Stack } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { WeeklyActivityCompactPanel } from '@/app/_components/weeklyActivity/WeeklyActivityCompactPanel';
import { WeeklyActivityCompactTeamList } from '@/app/_components/weeklyActivity/WeeklyActivityCompactTeamList';
import { WeeklyActivityQuickActionsPanel } from '@/app/_components/weeklyActivity/WeeklyActivityQuickActionsPanel';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { EditWeeklyActivityModal } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/EditWeeklyActivityModal';
import { HistoryWeeklyActivityModal } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/HistoryWeeklyActivityModal';
import {
  invalidateWeeklyActivityFromRealtimeEvent,
  useWeeklyActivities,
  type WeeklyActivityListItem,
} from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import { getBankWeekBounds } from '@/lib/bankWeek';
import { findOwnWeeklyActivityRow } from '@/lib/dispensaryWeeklyActivity/findOwnRow';
import { weeklyActivityFieldVisibilityFromSettings } from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import {
  isSameWeeklyActivityWeek,
  type WeeklyActivityWeekBounds,
} from '@/lib/dispensaryWeeklyActivity/queryKeys';
import { useWeeklyActivityRealtime } from '@/lib/dispensaryWeeklyActivity/realtime/client/useWeeklyActivityRealtime';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';

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
  periodWeekDateValue: Date;
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
  periodWeekDateValue,
}: EmployeeWeeklyDashboardProps) {
  const { appSettings } = usePermissions();
  const queryClient = useQueryClient();
  const fieldVisibility = useMemo(
    () => weeklyActivityFieldVisibilityFromSettings(appSettings),
    [appSettings],
  );

  const [editRow, setEditRow] = useState<WeeklyActivityListItem | null>(null);
  const [historyActivityId, setHistoryActivityId] = useState<string | null>(null);
  const [historyTitle, setHistoryTitle] = useState('');

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

  const handleRealtimeChange = useCallback(
    (event: WeeklyActivityRealtimeEvent) => {
      invalidateWeeklyActivityFromRealtimeEvent(queryClient, dispensarySlug, event, {
        visibleWeekBounds: queryWeekBounds,
        openHistoryActivityId: historyActivityId,
      });
    },
    [dispensarySlug, historyActivityId, queryClient, queryWeekBounds],
  );

  useWeeklyActivityRealtime({
    enabled: true,
    onChange: handleRealtimeChange,
  });

  const { data: fetchedRows = [] } = useWeeklyActivities(queryWeekBounds, {
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

  return (
    <>
      <Stack gap="lg">
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
