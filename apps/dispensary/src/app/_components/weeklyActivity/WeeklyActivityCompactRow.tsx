'use client';

import { ActionIcon, Group, Stack, Text } from '@mantine/core';
import { IconHistory, IconPencil } from '@tabler/icons-react';
import type { WeeklyActivityFieldVisibility } from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import { emptyWeekdayFlags } from '@/lib/dispensaryWeeklyActivity/weekdayFlags';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import {
  buildCompactCounterStats,
  buildCompactDayCells,
  COMPACT_DAY_LABELS,
  formatCompactCounterLine,
} from './compactDisplay';
import classes from './WeeklyActivityCompact.module.scss';

type WeeklyActivityCompactRowProps = {
  displayName: string;
  row: WeeklyActivityListItem | null;
  fieldVisibility: WeeklyActivityFieldVisibility;
  canEdit?: boolean;
  onEdit?: () => void;
  onHistory?: () => void;
  showName?: boolean;
  showDayHeaders?: boolean;
};

export function WeeklyActivityCompactRow({
  displayName,
  row,
  fieldVisibility,
  canEdit = false,
  onEdit,
  onHistory,
  showName = true,
  showDayHeaders = true,
}: WeeklyActivityCompactRowProps) {
  const chestDays = row?.chestDays ?? emptyWeekdayFlags();
  const presenceDays = row?.presenceDays ?? emptyWeekdayFlags();
  const dayCells = buildCompactDayCells(chestDays, presenceDays);
  const counterStats = buildCompactCounterStats(
    row ?? {
      patientsCount: 0,
      sherifCount: 0,
      infusionsCount: 0,
      poppyMilkCount: 0,
    },
    fieldVisibility,
  );
  const counterLine = formatCompactCounterLine(counterStats);
  const showDayGrid = fieldVisibility.chestDays || fieldVisibility.presenceDays;

  return (
    <div className={classes.teamRow}>
      <Group align="flex-start" wrap="nowrap" gap="lg" justify="space-between">
        <Group align="flex-start" wrap="nowrap" gap="lg" style={{ flex: 1, minWidth: 0 }}>
          {showName && (
            <Text className={classes.name} style={{ minWidth: '8rem', flexShrink: 0 }}>
              {displayName}
            </Text>
          )}
          {showDayGrid && (
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              {showDayHeaders && (
                <Group gap="md" wrap="nowrap" justify="flex-start">
                  {COMPACT_DAY_LABELS.map((label) => (
                    <Text key={label} className={classes.dayHeader}>
                      {label}
                    </Text>
                  ))}
                </Group>
              )}
              <Group gap="md" wrap="nowrap" justify="flex-start">
                {dayCells.map((cell, index) => (
                  <Text key={COMPACT_DAY_LABELS[index]} className={classes.dayCell}>
                    {cell}
                  </Text>
                ))}
              </Group>
              {counterLine ? (
                <Text className={classes.counterLine}>{counterLine}</Text>
              ) : null}
              {!row && (
                <Text className={classes.emptyHint}>Aucune saisie cette semaine</Text>
              )}
            </Stack>
          )}
          {!showDayGrid && counterLine ? (
            <Text className={classes.counterLine}>{counterLine}</Text>
          ) : null}
        </Group>
        {row && (onHistory || (canEdit && onEdit)) ? (
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            {onHistory ? (
              <ActionIcon
                variant="subtle"
                color="gray.0"
                onClick={onHistory}
                aria-label={`Historique de ${displayName}`}
                style={{ color: 'var(--mantine-color-sage-1)' }}
              >
                <IconHistory size={16} />
              </ActionIcon>
            ) : null}
            {canEdit && onEdit ? (
              <ActionIcon
                variant="subtle"
                color="gray.0"
                onClick={onEdit}
                aria-label={`Modifier l'activité de ${displayName}`}
                style={{ color: 'var(--mantine-color-sage-1)' }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            ) : null}
          </Group>
        ) : null}
      </Group>
    </div>
  );
}
