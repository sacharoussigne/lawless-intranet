'use client';

import { useEffect, useMemo, useState } from 'react';
import { Anchor, SegmentedControl, Select, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { AppModal } from '@/app/_components/AppModal/AppModal';
import dayjs from '@/lib/dayjs';
import type { WeeklyActivityWeekBounds } from '@/lib/dispensaryWeeklyActivity/queryKeys';
import {
  useWeeklyHoursRecap,
  type WeeklyHoursRecapDayDto,
} from './hooks/useWeeklyActivityQueries';

const TZ = 'Europe/Paris';

export type HoursRecapDoctorOption = { value: string; label: string };

type RecapView = 'week' | 'day';

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

function defaultDayInWeek(weekDays: string[]): string {
  if (weekDays.length === 0) return '';
  const today = dayjs().tz(TZ).format('YYYY-MM-DD');
  if (weekDays.includes(today)) return today;
  return weekDays[0] ?? '';
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
  const [view, setView] = useState<RecapView>('week');
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    if (opened) {
      setDiscordUserId(initialDiscordUserId);
      setView('week');
    }
  }, [opened, initialDiscordUserId]);

  const { data, isFetching } = useWeeklyHoursRecap(weekBounds, discordUserId, opened);
  const days = data?.days ?? [];
  const doctors = data?.doctors ?? [];

  useEffect(() => {
    if (days.length === 0) return;
    const weekDates = days.map((d) => d.date);
    setSelectedDate((current) =>
      current && weekDates.includes(current) ? current : defaultDayInWeek(weekDates),
    );
  }, [days]);

  const daySelectData = useMemo(
    () =>
      days.map((d) => ({
        value: d.date,
        label: formatParisDayLabel(d.date),
      })),
    [days],
  );

  const doctorRowsForDay = useMemo(() => {
    if (!selectedDate) return [];
    return doctors
      .map((doctor) => {
        const day = doctor.days.find((d) => d.date === selectedDate);
        if (!day) return null;
        const hasSignal =
          day.openAt != null ||
          day.closeAt != null ||
          (day.afternoonPatientsCount != null && day.afternoonPatientsCount > 0);
        return { doctor, day, hasSignal };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => {
        if (a.hasSignal !== b.hasSignal) return a.hasSignal ? -1 : 1;
        return a.doctor.displayName.localeCompare(b.doctor.displayName, 'fr');
      });
  }, [doctors, selectedDate]);

  const openDayView = (date: string) => {
    setSelectedDate(date);
    setView('day');
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Récap horaires"
      description="Ouverture / fermeture dérivées de l’historique (patients et présences)."
      size="xl"
    >
      <SegmentedControl
        fullWidth
        value={view}
        onChange={(value) => setView(value as RecapView)}
        data={[
          { label: 'Semaine', value: 'week' },
          { label: 'Jour', value: 'day' },
        ]}
      />

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

      {view === 'day' ? (
        <Select
          label="Jour"
          data={daySelectData}
          value={selectedDate || null}
          onChange={(value) => {
            if (value) setSelectedDate(value);
          }}
          searchable
        />
      ) : null}

      {isFetching && days.length === 0 ? (
        <Text c="dimmed" size="sm">
          Chargement…
        </Text>
      ) : view === 'week' ? (
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
                    <UnstyledButton onClick={() => openDayView(day.date)}>
                      <Text size="sm" tt="capitalize" c="sage" td="underline">
                        {formatParisDayLabel(day.date)}
                      </Text>
                    </UnstyledButton>
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
            Clique un jour pour voir le détail par médecin. Ignoré : 00h01–11h59. Aprem =
            12h00–20h00 inclus (hors ouverture).
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Médecin</Table.Th>
                <Table.Th>Ouverture</Table.Th>
                <Table.Th>Fermeture</Table.Th>
                <Table.Th>Aprem</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {doctorRowsForDay.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" size="sm">
                      Aucun médecin pour cette semaine.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                doctorRowsForDay.map(({ doctor, day }) => (
                  <Table.Tr key={doctor.activityId}>
                    <Table.Td>
                      <HistoryLink
                        label={doctor.displayName}
                        activityId={doctor.activityId}
                        title={doctor.displayName}
                        onOpenHistory={onOpenHistory}
                      />
                    </Table.Td>
                    <Table.Td>
                      <HistoryLink
                        label={formatParisTime(day.openAt)}
                        activityId={day.openByActivityId}
                        title={doctor.displayName}
                        onOpenHistory={onOpenHistory}
                      />
                    </Table.Td>
                    <Table.Td>
                      <HistoryLink
                        label={formatParisTime(day.closeAt)}
                        activityId={day.closeByActivityId}
                        title={doctor.displayName}
                        onOpenHistory={onOpenHistory}
                      />
                    </Table.Td>
                    <Table.Td>
                      <HistoryLink
                        label={afternoonLabel(day)}
                        activityId={day.afternoonActivityId}
                        title={doctor.displayName}
                        onOpenHistory={onOpenHistory}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed">
            Vue jour : horaires de chaque médecin pour la date sélectionnée.
          </Text>
        </Stack>
      )}
    </AppModal>
  );
}
