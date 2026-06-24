'use client';

import { Group, Paper, Stack, Text } from '@mantine/core';
import type { WeeklyActivityFieldVisibility } from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import { COMPACT_DAY_LABELS } from './compactDisplay';
import { WeeklyActivityCompactRow } from './WeeklyActivityCompactRow';
import classes from './WeeklyActivityCompact.module.scss';

type WeeklyActivityCompactTeamListProps = {
  rows: WeeklyActivityListItem[];
  fieldVisibility: WeeklyActivityFieldVisibility;
  canEditRow: (row: WeeklyActivityListItem) => boolean;
  onEdit: (row: WeeklyActivityListItem) => void;
  title?: string;
};

export function WeeklyActivityCompactTeamList({
  rows,
  fieldVisibility,
  canEditRow,
  onEdit,
  title = "Activité de l'équipe",
}: WeeklyActivityCompactTeamListProps) {
  const showDayGrid = fieldVisibility.chestDays || fieldVisibility.presenceDays;

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="md"
      p="lg"
      bg="sage.9"
      className={classes.panel}
    >
      <Text size="sm" fw={500} mb="md" className={classes.panelTitle}>
        {title}
      </Text>

      {showDayGrid && rows.length > 0 && (
        <Group gap="lg" wrap="nowrap" mb="sm" pl="calc(8rem + var(--mantine-spacing-lg))">
          {COMPACT_DAY_LABELS.map((label) => (
            <Text key={label} className={classes.dayHeader}>
              {label}
            </Text>
          ))}
        </Group>
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
              showDayHeaders={false}
            />
          ))
        )}
      </Stack>
    </Paper>
  );
}
