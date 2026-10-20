'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Divider, NumberInput, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import type { WeeklyActivityFieldVisibility } from '@/lib/businessWeeklyActivity/fieldVisibility';
import { isIntranetActivityWeekdayEditable } from '@/lib/businessWeeklyActivity/botDayEdit';
import { emptyWeekdayFlags, WEEKDAY_KEYS, type WeekdayFlags, type WeekdayKey } from '@/lib/businessWeeklyActivity/weekdayFlags';
import type { WeeklyActivityWeekBounds } from '@/lib/businessWeeklyActivity/queryKeys';
import { DayFlagFields } from './weeklyActivityUtils';
import {
  useUpdateWeeklyActivityMutation,
  type WeeklyActivityListItem,
} from './hooks/useWeeklyActivityQueries';

type EditWeeklyActivityModalProps = {
  row: WeeklyActivityListItem | null;
  onClose: () => void;
  canEditAll: boolean;
  fieldVisibility: WeeklyActivityFieldVisibility;
  weekBounds: WeeklyActivityWeekBounds;
};

export function EditWeeklyActivityModal({
  row,
  onClose,
  canEditAll,
  fieldVisibility,
  weekBounds,
}: EditWeeklyActivityModalProps) {
  const updateMutation = useUpdateWeeklyActivityMutation();

  const [eChestFlags, setEChestFlags] = useState<WeekdayFlags>(() => emptyWeekdayFlags());
  const [ePresenceFlags, setEPresenceFlags] = useState<WeekdayFlags>(() => emptyWeekdayFlags());
  const [eCounters, setECounters] = useState<Record<string, number>>({});
  const [eDisplayName, setEDisplayName] = useState('');

  const hasWeeklyScheduleFields = fieldVisibility.chestDays || fieldVisibility.presenceDays;
  const hasWeeklyCounterFields = fieldVisibility.counters.length > 0;

  const disabledWeekdayKeys = useMemo(() => {
    if (!row || canEditAll) return new Set<WeekdayKey>();
    const periodStart = new Date(row.periodStart);
    return new Set(
      WEEKDAY_KEYS.filter((key) => !isIntranetActivityWeekdayEditable(periodStart, key, false)),
    );
  }, [row, canEditAll]);

  useEffect(() => {
    if (!row) return;
    setEChestFlags({ ...row.chestDays });
    setEPresenceFlags({ ...row.presenceDays });
    setECounters({ ...row.counters });
    setEDisplayName(row.displayName);
  }, [row]);

  const submitEdit = async () => {
    if (!row) return;
    const base = {
      id: row.id,
      ...(fieldVisibility.chestDays ? { chestDays: eChestFlags } : {}),
      ...(fieldVisibility.presenceDays ? { presenceDays: ePresenceFlags } : {}),
      // Only the visible counters: the hidden ones keep their value.
      ...(hasWeeklyCounterFields
        ? {
            counters: Object.fromEntries(
              fieldVisibility.counters.map((c) => [c.key, eCounters[c.key] ?? 0]),
            ),
          }
        : {}),
    };
    await updateMutation.mutateAsync({
      payload: canEditAll
        ? { ...base, displayName: eDisplayName.trim() || row.displayName }
        : base,
      weekBounds,
    });
    onClose();
  };

  return (
    <AppModal
      opened={row !== null}
      onClose={onClose}
      title="Modifier l’activité"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={updateMutation.isPending} onClick={() => void submitEdit()}>
            Enregistrer
          </Button>
        </AppModalFooter>
      }
    >
      {row && (
        <Stack gap="lg">
          <Text size="sm" fw={500}>
            {row.resolvedDisplayName}
          </Text>
          {canEditAll && (
            <TextInput
              label="Nom affiché"
              value={eDisplayName}
              onChange={(e) => setEDisplayName(e.currentTarget.value)}
            />
          )}

          {fieldVisibility.chestDays && (
            <DayFlagFields
              title="Caisses (par jour de semaine)"
              flags={eChestFlags}
              disabledKeys={disabledWeekdayKeys}
              onToggle={(key: WeekdayKey, value: boolean) =>
                setEChestFlags((p) => ({ ...p, [key]: value }))
              }
            />
          )}
          {fieldVisibility.presenceDays && (
            <DayFlagFields
              title="Présences (par jour)"
              flags={ePresenceFlags}
              disabledKeys={disabledWeekdayKeys}
              onToggle={(key: WeekdayKey, value: boolean) =>
                setEPresenceFlags((p) => ({ ...p, [key]: value }))
              }
            />
          )}

          {hasWeeklyCounterFields && (
            <>
              {hasWeeklyScheduleFields && <Divider />}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {fieldVisibility.counters.map((counter) => (
                  <NumberInput
                    key={counter.key}
                    label={counter.label}
                    value={eCounters[counter.key] ?? 0}
                    onChange={(v) =>
                      setECounters((prev) => ({ ...prev, [counter.key]: Number(v) || 0 }))
                    }
                    min={0}
                  />
                ))}
              </SimpleGrid>
            </>
          )}
        </Stack>
      )}
    </AppModal>
  );
}
