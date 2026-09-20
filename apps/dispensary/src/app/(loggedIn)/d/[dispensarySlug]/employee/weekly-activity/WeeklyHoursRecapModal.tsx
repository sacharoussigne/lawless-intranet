'use client';

import { useEffect, useState } from 'react';
import { Anchor, Select, Stack, Table, Text } from '@mantine/core';
import { AppModal } from '@/app/_components/AppModal/AppModal';
import dayjs from '@/lib/dayjs';
import type { WeeklyActivityWeekBounds } from '@/lib/dispensaryWeeklyActivity/queryKeys';
import {
  useWeeklyHoursRecap,
  type WeeklyHoursRecapDayDto,
} from './hooks/useWeeklyActivityQueries';

const TZ = 'Europe/Paris';

export type HoursRecapDoctorOption = { value: string; label: string };

type WeeklyHoursRecapModalProps = {
  opened: boolean;
  onClose: () => void;
  weekBounds: WeeklyActivityWeekBounds;
  doctorOptions: HoursRecapDoctorOption[];
  initialDiscordUserId: string | null;
  onOpenHistory: (activityId: string, title: string) => void;
};

function formatParisTime(iso: string | null): string {
  if (!iso) return '—';
  return dayjs(iso).tz(TZ).format('HH:mm');
}

function formatParisDayLabel(dateStr: string): string {
  return dayjs.tz(dateStr, 'YYYY-MM-DD', TZ).format('dddd D MMM');
}

function HistoryLink({
  label,
  activityId,
  title,
  onOpenHistory,
}: {
  label: string;
  activityId: string | null;
  title: string;
  onOpenHistory: (activityId: string, title: string) => void;
}) {
  if (!activityId || label === '—') {
    return <Text size="sm">{label}</Text>;
  }
  return (
    <Anchor
      component="button"
      type="button"
      size="sm"
      onClick={() => onOpenHistory(activityId, title)}
    >
      {label}
    </Anchor>
  );
}

function afternoonLabel(day: WeeklyHoursRecapDayDto): string {
  if (day.afternoonPatientsCount == null) return '—';
  const n = day.afternoonPatientsCount;
  return `${n} soigné${n > 1 ? 's' : ''}`;
}

export function WeeklyHoursRecapModal({
  opened,
  onClose,
  weekBounds,
  doctorOptions,
  initialDiscordUserId,
  onOpenHistory,
}: WeeklyHoursRecapModalProps) {
  const [discordUserId, setDiscordUserId] = useState<string | null>(initialDiscordUserId);

  useEffect(() => {
    if (opened) {
      setDiscordUserId(initialDiscordUserId);
    }
  }, [opened, initialDiscordUserId]);

  const { data: days = [], isFetching } = useWeeklyHoursRecap(
    weekBounds,
    discordUserId,
    opened,
  );

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Récap horaires"
      description="Ouverture / fermeture dérivées de l’historique (patients et présences)."
      size="xl"
    >
      <Select
        label="Médecin"
        placeholder="Tous les médecins"
        data={doctorOptions}
        value={discordUserId}
        onChange={(value) => setDiscordUserId(value)}
        searchable
        clearable
        nothingFoundMessage="Aucun résultat"
      />

      {isFetching && days.length === 0 ? (
        <Text c="dimmed" size="sm">
          Chargement…
        </Text>
      ) : (
        <Stack gap="sm">
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Jour</Table.Th>
                <Table.Th>Ouverture</Table.Th>
                <Table.Th>Par qui</Table.Th>
                <Table.Th>Fermeture</Table.Th>
                <Table.Th>Aprem</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {days.map((day) => (
                <Table.Tr key={day.date}>
                  <Table.Td>
                    <Text size="sm" tt="capitalize">
                      {formatParisDayLabel(day.date)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <HistoryLink
                      label={formatParisTime(day.openAt)}
                      activityId={day.openByActivityId}
                      title={day.openByName ?? 'Activité'}
                      onOpenHistory={onOpenHistory}
                    />
                  </Table.Td>
                  <Table.Td>
                    <HistoryLink
                      label={day.openByName ?? '—'}
                      activityId={day.openByActivityId}
                      title={day.openByName ?? 'Activité'}
                      onOpenHistory={onOpenHistory}
                    />
                  </Table.Td>
                  <Table.Td>
                    <HistoryLink
                      label={formatParisTime(day.closeAt)}
                      activityId={day.closeByActivityId}
                      title={day.closeByName ?? 'Activité'}
                      onOpenHistory={onOpenHistory}
                    />
                  </Table.Td>
                  <Table.Td>
                    <HistoryLink
                      label={afternoonLabel(day)}
                      activityId={day.afternoonActivityId}
                      title={day.afternoonByName ?? 'Activité'}
                      onOpenHistory={onOpenHistory}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed">
            Aprem = patients entre 12h00 et 20h00 inclus (hors ouverture). Fermeture = dernier
            patient du jour. Patients 0h–6h rattachés au jour précédent.
          </Text>
        </Stack>
      )}
    </AppModal>
  );
}
