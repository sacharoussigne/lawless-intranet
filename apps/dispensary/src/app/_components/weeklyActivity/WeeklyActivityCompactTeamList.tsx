'use client';

import { Paper, Stack, Text } from '@mantine/core';
import type { WeeklyActivityFieldVisibility } from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/d/[dispensarySlug]/employee/(activity)/weekly-activity/hooks/useWeeklyActivityQueries';
import { COMPACT_DAY_LABELS } from './compactDisplay';
import { WeeklyActivityCompactRow } from './WeeklyActivityCompactRow';
import classes from './WeeklyActivityCompact.module.scss';

type WeeklyActivityCompactTeamListProps = {
  rows: WeeklyActivityListItem[];
  fieldVisibility: WeeklyActivityFieldVisibility;
  canEditRow: (row: WeeklyActivityListItem) => boolean;
  onEdit: (row: WeeklyActivityListItem) => void;
  onHistory: (row: WeeklyActivityListItem) => void;
  title?: string;
};

export function WeeklyActivityCompactTeamList({
  rows,
  fieldVisibility,
  canEditRow,
  onEdit,
  onHistory,
  title = "Activité de l'équipe",
}: WeeklyActivityCompactTeamListProps) {
  const showDayGrid = fieldVisibility.chestDays || fieldVisibility.presenceDays;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="md"
      p={{ base: 'md', sm: 'lg' }}
      bg="sage.9"
      className={classes.panel}
    >
      <Text size="sm" fw={500} mb="md" className={classes.panelTitle}>
        {title}
      </Text>

      {showDayGrid && rows.length > 0 && (
        <div className={`${classes.dayGrid} ${classes.teamHeader}`}>
          {COMPACT_DAY_LABELS.map((label) => (
            <Text key={label} className={classes.dayHeader}>
              {label}
            </Text>
          ))}
        </div>
      )}

      <Stack gap={0}>
        {rows.length === 0 ? (
          <Text className={classes.emptyHint}>Aucune activité enregistrée pour cette semaine.</Text>
        ) : (
          rows.map((row) => (
            <WeeklyActivityCompactRow
              key={row.id}
              displayName={row.resolvedDisplayName}
              row={row}
              fieldVisibility={fieldVisibility}
              canEdit={canEditRow(row)}
              onEdit={() => onEdit(row)}
              onHistory={() => onHistory(row)}
              showDayHeaders={false}
            />
          ))
        )}
      </Stack>
    </Paper>
  );
}
