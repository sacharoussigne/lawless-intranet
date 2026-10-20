'use client';

import { Alert, Button, Paper, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconCashRegister, IconUserCheck } from '@tabler/icons-react';
import type { WeeklyActivityFieldVisibility } from '@/lib/businessWeeklyActivity/fieldVisibility';
import { parisWeekdayKey } from '@/lib/businessWeeklyActivity/weekdayFlags';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/[businessSlug]/employee/(activity)/weekly-activity/hooks/useWeeklyActivityQueries';
import {
  useIncrementOwnWeeklyCounterMutation,
  useMarkOwnWeeklyChestTodayMutation,
  useMarkOwnWeeklyPresenceTodayMutation,
} from '@/app/(loggedIn)/[businessSlug]/employee/(activity)/weekly-activity/hooks/useWeeklyActivityQueries';
import type { WeeklyActivityWeekBounds } from '@/lib/businessWeeklyActivity/queryKeys';
import { WEEKLY_COUNTER_ICONS } from './counterIcons';
import classes from './WeeklyActivityQuickActionsPanel.module.scss';

type WeeklyActivityQuickActionsPanelProps = {
  row: WeeklyActivityListItem | null;
  fieldVisibility: WeeklyActivityFieldVisibility;
  weekBounds: WeeklyActivityWeekBounds;
  hasDiscord: boolean;
  canEdit: boolean;
};

export function WeeklyActivityQuickActionsPanel({
  row,
  fieldVisibility,
  weekBounds,
  hasDiscord,
  canEdit,
}: WeeklyActivityQuickActionsPanelProps) {
  const chestMutation = useMarkOwnWeeklyChestTodayMutation();
  const presenceMutation = useMarkOwnWeeklyPresenceTodayMutation();
  const incrementMutation = useIncrementOwnWeeklyCounterMutation();

  if (!canEdit) {
    return null;
  }

  const todayKey = parisWeekdayKey(new Date());
  const chestDone = row?.chestDays[todayKey] ?? false;
  const presenceDone = row?.presenceDays[todayKey] ?? false;

  const isLoading =
    chestMutation.isPending || presenceMutation.isPending || incrementMutation.isPending;

  // Counters of the business type that are not turned off (lib/businessTypes).
  const visibleCounters = fieldVisibility.counters;

  return (
    <Paper withBorder shadow="sm" radius="md" p={{ base: 'md', sm: 'lg' }}>
      <Text size="sm" fw={500} mb="md" className="disp-display-title">
        Actions rapides
      </Text>

      {!hasDiscord ? (
        <Alert color="amber" title="Discord requis">
          Liez votre compte Discord dans les paramètres pour enregistrer votre activité.
        </Alert>
      ) : (
        <Stack gap="md">
          {/* Phones: side by side with short labels (« aujourd'hui » is implied). */}
          <SimpleGrid cols={2} spacing="sm">
            {fieldVisibility.chestDays && (
              <Button
                color="sage"
                variant={chestDone ? 'light' : 'filled'}
                leftSection={<IconCashRegister size={18} />}
                disabled={chestDone || isLoading}
                loading={chestMutation.isPending}
                onClick={() => chestMutation.mutate({ weekBounds })}
              >
                <span className={classes.desktopLabel}>
                  {chestDone ? 'Caisse enregistrée' : "Caisse aujourd'hui"}
                </span>
                <span className={classes.phoneLabel}>{chestDone ? 'Caisse faite' : 'Caisse'}</span>
              </Button>
            )}
            {fieldVisibility.presenceDays && (
              <Button
                color="sage"
                variant={presenceDone ? 'light' : 'filled'}
                leftSection={<IconUserCheck size={18} />}
                disabled={presenceDone || isLoading}
                loading={presenceMutation.isPending}
                onClick={() => presenceMutation.mutate({ weekBounds })}
              >
                <span className={classes.desktopLabel}>
                  {presenceDone ? 'Présence enregistrée' : "Présence aujourd'hui"}
                </span>
                <span className={classes.phoneLabel}>{presenceDone ? 'Présence faite' : 'Présence'}</span>
              </Button>
            )}
          </SimpleGrid>

          {visibleCounters.length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: 6, sm: 'sm' }}>
              {visibleCounters.map((counter) => {
                const Icon = WEEKLY_COUNTER_ICONS[counter.icon];
                const label = counter.shortLabel ?? counter.label;
                const value = row?.counters[counter.key] ?? 0;
                return (
                  <UnstyledButton
                    key={counter.key}
                    className={classes.counterTile}
                    disabled={isLoading}
                    aria-label={`${label} : ${value}, ajouter 1`}
                    onClick={() =>
                      incrementMutation.mutate({ counterKey: counter.key, weekBounds })
                    }
                  >
                    <div className={classes.counterTileInner}>
                      <div className={classes.counterTileLabel}>
                        <Icon size={16} stroke={1.75} className={classes.counterIcon} />
                        <Text size="sm" truncate className={classes.counterName}>
                          {label}
                        </Text>
                        <Text size="sm" fw={600} className={classes.counterValue}>
                          {value}
                        </Text>
                      </div>
                      <span className={classes.counterTilePlus}>+1</span>
                    </div>
                  </UnstyledButton>
                );
              })}
            </SimpleGrid>
          )}
        </Stack>
      )}
    </Paper>
  );
}
