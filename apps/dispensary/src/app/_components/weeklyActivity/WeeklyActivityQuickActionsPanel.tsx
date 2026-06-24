'use client';

import { Alert, Button, Paper, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import {
  IconCashRegister,
  IconDroplet,
  IconMilk,
  IconShield,
  IconUserPlus,
  IconUserCheck,
} from '@tabler/icons-react';
import type { WeeklyActivityFieldVisibility } from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import { parisWeekdayKey } from '@/lib/dispensaryWeeklyActivity/weekdayFlags';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import {
  useIncrementOwnWeeklyCounterMutation,
  useMarkOwnWeeklyChestTodayMutation,
  useMarkOwnWeeklyPresenceTodayMutation,
} from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import type { WeeklyActivityWeekBounds } from '@/lib/dispensaryWeeklyActivity/queryKeys';
import classes from './WeeklyActivityQuickActionsPanel.module.scss';

type WeeklyActivityQuickActionsPanelProps = {
  row: WeeklyActivityListItem | null;
  fieldVisibility: WeeklyActivityFieldVisibility;
  weekBounds: WeeklyActivityWeekBounds;
  hasDiscord: boolean;
  canEdit: boolean;
};

type CounterField = 'patientsCount' | 'sherifCount' | 'infusionsCount' | 'poppyMilkCount';

const COUNTER_ACTIONS: {
  field: CounterField;
  label: string;
  icon: typeof IconUserPlus;
}[] = [
  { field: 'patientsCount', label: 'Patients', icon: IconUserPlus },
  { field: 'sherifCount', label: 'Shérifs', icon: IconShield },
  { field: 'infusionsCount', label: 'Infusion', icon: IconDroplet },
  { field: 'poppyMilkCount', label: 'Lait pavot', icon: IconMilk },
];

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

  const visibleCounters = COUNTER_ACTIONS.filter((action) => fieldVisibility[action.field]);

  return (
    <Paper withBorder shadow="sm" radius="md" p="lg">
      <Text size="sm" fw={500} mb="md" className="disp-display-title">
        Actions rapides
      </Text>

      {!hasDiscord ? (
        <Alert color="amber" title="Discord requis">
          Liez votre compte Discord dans les paramètres pour enregistrer votre activité.
        </Alert>
      ) : (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {fieldVisibility.presenceDays && (
              <Button
                color="sage"
                variant={presenceDone ? 'light' : 'filled'}
                leftSection={<IconUserCheck size={18} />}
                disabled={presenceDone || isLoading}
                loading={presenceMutation.isPending}
                onClick={() => presenceMutation.mutate({ weekBounds })}
              >
                {presenceDone ? 'Présence enregistrée' : "Présence aujourd'hui"}
              </Button>
            )}
            {fieldVisibility.chestDays && (
              <Button
                color="sage"
                variant={chestDone ? 'light' : 'filled'}
                leftSection={<IconCashRegister size={18} />}
                disabled={chestDone || isLoading}
                loading={chestMutation.isPending}
                onClick={() => chestMutation.mutate({ weekBounds })}
              >
                {chestDone ? 'Caisse enregistrée' : "Caisse aujourd'hui"}
              </Button>
            )}
          </SimpleGrid>

          {visibleCounters.length > 0 && (
            <SimpleGrid cols={2} spacing="sm">
              {visibleCounters.map((action) => {
                const Icon = action.icon;
                const value = row?.[action.field] ?? 0;
                return (
                  <UnstyledButton
                    key={action.field}
                    className={classes.counterTile}
                    disabled={isLoading}
                    aria-label={`${action.label} : ${value}, ajouter 1`}
                    onClick={() =>
                      incrementMutation.mutate({ field: action.field, weekBounds })
                    }
                  >
                    <div className={classes.counterTileInner}>
                      <div className={classes.counterTileLabel}>
                        <Icon size={16} stroke={1.75} />
                        <Text size="sm" truncate>
                          {action.label}
                        </Text>
                        <Text size="sm" fw={600}>
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
