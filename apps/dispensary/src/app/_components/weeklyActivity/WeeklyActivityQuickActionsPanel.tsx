'use client';

import { Alert, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
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
  { field: 'infusionsCount', label: 'Inf. ginseng', icon: IconDroplet },
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
            <Stack gap="xs">
              {visibleCounters.map((action) => {
                const Icon = action.icon;
                const value = row?.[action.field] ?? 0;
                return (
                  <Group
                    key={action.field}
                    justify="space-between"
                    wrap="nowrap"
                    gap="sm"
                    p="xs"
                    style={{
                      border: '1px solid var(--mantine-color-sage-3)',
                      borderRadius: 'var(--mantine-radius-sm)',
                    }}
                  >
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Icon size={16} stroke={1.75} />
                      <Text size="sm" truncate>
                        {action.label}
                      </Text>
                      <Text size="sm" fw={600}>
                        {value}
                      </Text>
                    </Group>
                    <Button
                      size="compact-sm"
                      color="sage"
                      variant="filled"
                      disabled={isLoading}
                      loading={incrementMutation.isPending}
                      onClick={() =>
                        incrementMutation.mutate({ field: action.field, weekBounds })
                      }
                    >
                      +1
                    </Button>
                  </Group>
                );
              })}
            </Stack>
          )}
        </Stack>
      )}
    </Paper>
  );
}
