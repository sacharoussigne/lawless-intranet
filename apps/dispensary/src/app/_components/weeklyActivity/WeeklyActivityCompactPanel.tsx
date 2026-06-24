'use client';

import { Paper, Text } from '@mantine/core';
import type { WeeklyActivityFieldVisibility } from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import { WeeklyActivityCompactRow } from './WeeklyActivityCompactRow';
import classes from './WeeklyActivityCompact.module.scss';

type WeeklyActivityCompactPanelProps = {
  displayName: string;
  row: WeeklyActivityListItem | null;
  fieldVisibility: WeeklyActivityFieldVisibility;
  canEdit?: boolean;
  onEdit?: () => void;
  title?: string;
};

export function WeeklyActivityCompactPanel({
  displayName,
  row,
  fieldVisibility,
  canEdit = false,
  onEdit,
  title = 'Mon activité',
}: WeeklyActivityCompactPanelProps) {
  return (
    <Paper
      withBorder
      shadow="sm"
      radius="md"
      p="lg"
      bg="sage.9"
      className={classes.panel}
    >
      <Text size="sm" fw={500} mb="sm" className={classes.panelTitle}>
        {title}
      </Text>
      <WeeklyActivityCompactRow
        displayName={displayName}
        row={row}
        fieldVisibility={fieldVisibility}
        canEdit={canEdit}
        onEdit={onEdit}
        showName={false}
      />
    </Paper>
  );
}
