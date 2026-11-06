'use client';

import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  Timeline,
  Tooltip,
} from '@mantine/core';
import { useForm, type UseFormReturnType } from '@mantine/form';
import { IconArrowBackUp, IconDoorEnter, IconDoorExit, IconEdit, IconStairsUp } from '@tabler/icons-react';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { RpDateInput } from '@/app/_components/RpDatePicker/RpDateInput';
import {
  PAYROLL_EMPLOYEE_ROLES,
  toPayrollEmployeeRole,
} from '@/lib/businessDiscordProfile/constants';
import { getTodayRealDate } from '@/lib/rpCalendar';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { handleApiZodError } from '@/lib/services/zod';
import type { BusinessPerson } from '@/lib/people/types';
import {
  EMPLOYMENT_END_REASON_LABELS,
  EMPLOYMENT_END_REASONS,
  type Employment,
  type EmploymentEndReason,
  type EmploymentEvent,
} from '@/lib/staff/types';
import {
  useCancelStaffEventMutation,
  useChangeRoleMutation,
  useEndEmploymentMutation,
  useHireMutation,
  useStaffHistory,
  useUpdateStaffEventMutation,
} from '../hooks/useStaffQueries';
import { EmploymentStatusBadge } from './EmploymentStatusBadge';

const ROLE_OPTIONS = PAYROLL_EMPLOYEE_ROLES.map((role) => ({ value: role, label: role }));
const END_REASON_OPTIONS = EMPLOYMENT_END_REASONS.map((reason) => ({
  value: reason,
  label: EMPLOYMENT_END_REASON_LABELS[reason],
}));

export function StaffHistoryModal({ person, onClose }: { person: BusinessPerson | null; onClose: () => void }) {
  return (
    <AppModal
      opened={person != null}
      onClose={onClose}
      title={person ? `Parcours de ${person.displayName}` : 'Parcours'}
      size="lg"
    >
      {person && <StaffHistory key={person.discordUserId} person={person} />}
    </AppModal>
  );
}

function StaffHistory({ person }: { person: BusinessPerson }) {
  const { data: stays, isPending } = useStaffHistory(person.discordUserId);
  const latestEventId = stays?.[0]?.events[0]?.id ?? null;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <EmploymentStatusBadge status={person.employment} />
        {person.role && (
          <Text size="sm" c="dimmed">
            Grade actuel : {person.role}
          </Text>
        )}
      </Group>

      {person.employment.active ? <ActiveStaffForms person={person} /> : <HireForm person={person} />}

      <hr className="disp-section-divider" />

      {isPending ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : !stays || stays.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aucun passage enregistré pour cette personne.
        </Text>
      ) : (
        stays.map((stay, index) => (
          <StayCard key={stay.id} stay={stay} number={stays.length - index} latestEventId={latestEventId} />
        ))
      )}
    </Stack>
  );
}

/** Zod errors go to the form; the others are notified by the mutation. */
async function submitStaffForm<T>(form: UseFormReturnType<T>, submit: () => Promise<unknown>) {
  try {
    await submit();
    form.reset();
  } catch (error: unknown) {
    if (error instanceof ParsedZodError) handleApiZodError(error.error, form);
  }
}

type HireValues = { role: string | null; date: Date | null; note: string };

function HireForm({ person }: { person: BusinessPerson }) {
  const mutation = useHireMutation();
  const form = useForm<HireValues>({
    initialValues: { role: toPayrollEmployeeRole(person.role), date: getTodayRealDate(), note: '' },
    validate: {
      role: (value) => (value ? null : 'Le grade est requis'),
      date: (value) => (value ? null : 'La date est requise'),
    },
  });
  const submit = (run: () => Promise<unknown>) => submitStaffForm(form, run);

  return (
    <form
      {...noAutofillProps}
      onSubmit={form.onSubmit(
        (values) =>
          void submit(() =>
            mutation.mutateAsync({
              discordUserId: person.discordUserId,
              role: toPayrollEmployeeRole(values.role),
              startedAt: values.date ?? getTodayRealDate(),
              note: values.note,
            }),
          ),
      )}
    >
      <Paper withBorder p="md">
        <Stack gap="sm">
          <Text fw={600}>{person.employment.stays > 0 ? 'Réembaucher' : 'Embaucher'}</Text>
          <Group grow align="flex-start">
            <Select label="Grade" data={ROLE_OPTIONS} searchable withAsterisk {...form.getInputProps('role')} />
            <RpDateInput
              label="Date d'embauche"
              withAsterisk
              value={form.values.date}
              onChange={(date) => form.setFieldValue('date', date)}
              error={form.errors.date}
            />
          </Group>
          <Textarea label="Note" autosize minRows={1} maxLength={1000} {...form.getInputProps('note')} />
          <AppModalFooter>
            <Button type="submit" leftSection={<IconDoorEnter size={16} />} loading={mutation.isPending}>
              Embaucher
            </Button>
          </AppModalFooter>
        </Stack>
      </Paper>
    </form>
  );
}

type ActiveValues = {
  role: string | null;
  date: Date | null;
  endReason: EmploymentEndReason | null;
  note: string;
};

function ActiveStaffForms({ person }: { person: BusinessPerson }) {
  const [mode, setMode] = useState<'role' | 'leave'>('role');
  const changeRole = useChangeRoleMutation();
  const end = useEndEmploymentMutation();
  const form = useForm<ActiveValues>({
    initialValues: { role: toPayrollEmployeeRole(person.role), date: getTodayRealDate(), endReason: null, note: '' },
    validate: {
      date: (value) => (value ? null : 'La date est requise'),
      endReason: (value) => (mode === 'leave' && !value ? 'Le motif est requis' : null),
    },
  });
  const submit = (run: () => Promise<unknown>) => submitStaffForm(form, run);

  const handleSubmit = (values: ActiveValues) => {
    const date = values.date ?? getTodayRealDate();
    if (mode === 'role') {
      return submit(() =>
        changeRole.mutateAsync({
          discordUserId: person.discordUserId,
          role: toPayrollEmployeeRole(values.role),
          occurredAt: date,
          note: values.note,
        }),
      );
    }
    return submit(() =>
      end.mutateAsync({
        discordUserId: person.discordUserId,
        endedAt: date,
        endReason: values.endReason ?? 'OTHER',
        note: values.note,
      }),
    );
  };

  return (
    <form {...noAutofillProps} onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      <Paper withBorder p="md">
        <Stack gap="sm">
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value === 'leave' ? 'leave' : 'role')}
            data={[
              { value: 'role', label: 'Changer de grade' },
              { value: 'leave', label: 'Départ' },
            ]}
          />
          <Group grow align="flex-start">
            {mode === 'role' ? (
              <Select label="Nouveau grade" data={ROLE_OPTIONS} searchable {...form.getInputProps('role')} />
            ) : (
              <Select label="Motif" data={END_REASON_OPTIONS} withAsterisk {...form.getInputProps('endReason')} />
            )}
            <RpDateInput
              label={mode === 'role' ? 'Date du changement' : 'Date de départ'}
              withAsterisk
              value={form.values.date}
              onChange={(date) => form.setFieldValue('date', date)}
              error={form.errors.date}
            />
          </Group>
          <Textarea label="Note" autosize minRows={1} maxLength={1000} {...form.getInputProps('note')} />
          <AppModalFooter>
            {mode === 'role' ? (
              <Button type="submit" leftSection={<IconStairsUp size={16} />} loading={changeRole.isPending}>
                Changer le grade
              </Button>
            ) : (
              <Button type="submit" color="danger" leftSection={<IconDoorExit size={16} />} loading={end.isPending}>
                Enregistrer le départ
              </Button>
            )}
          </AppModalFooter>
        </Stack>
      </Paper>
    </form>
  );
}

function StayCard({ stay, number, latestEventId }: { stay: Employment; number: number; latestEventId: string | null }) {
  const { formatRpDate } = useRpCalendar();
  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Passage n°{number}</Text>
        <Text size="sm" c="dimmed">
          {formatRpDate(stay.startedAt)} → {stay.endedAt ? formatRpDate(stay.endedAt) : 'aujourd’hui'}
        </Text>
      </Group>
      <Timeline bulletSize={24} lineWidth={2} active={stay.events.length}>
        {stay.events.map((event) => (
          <EventItem key={event.id} event={event} canCancel={event.id === latestEventId} />
        ))}
      </Timeline>
    </Paper>
  );
}

function eventTitle(event: EmploymentEvent): string {
  switch (event.type) {
    case 'HIRED':
      return event.toRole ? `Embauche · ${event.toRole}` : 'Embauche';
    case 'ROLE_CHANGED':
      return `${event.fromRole ?? 'Sans grade'} → ${event.toRole ?? 'Sans grade'}`;
    case 'LEFT':
      return event.endReason ? `Départ · ${EMPLOYMENT_END_REASON_LABELS[event.endReason]}` : 'Départ';
  }
}

const EVENT_ICONS = {
  HIRED: <IconDoorEnter size={14} />,
  ROLE_CHANGED: <IconStairsUp size={14} />,
  LEFT: <IconDoorExit size={14} />,
} as const;

/** Timeline items render through Timeline's children: the item itself must be the direct child. */
function EventItem({ event, canCancel, ...timelineProps }: { event: EmploymentEvent; canCancel: boolean }) {
  const { formatRpDate } = useRpCalendar();
  const [editing, setEditing] = useState(false);
  const cancel = useCancelStaffEventMutation();

  return (
    <Timeline.Item
      {...timelineProps}
      bullet={EVENT_ICONS[event.type]}
      color={event.type === 'LEFT' ? 'leather' : 'sage'}
      title={
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={600}>
            {eventTitle(event)}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Corriger" withArrow>
              <ActionIcon variant="light" color="slate" size="sm" onClick={() => setEditing((v) => !v)} aria-label="Corriger l'événement">
                <IconEdit size={14} />
              </ActionIcon>
            </Tooltip>
            {canCancel && (
              <DeleteConfirmPopover
                title="Annuler cet événement ?"
                message={
                  event.type === 'HIRED'
                    ? 'Le passage entier est supprimé.'
                    : event.type === 'LEFT'
                      ? 'La personne redevient employée.'
                      : 'Le grade précédent est rétabli.'
                }
                confirmLabel="Annuler l'événement"
                onConfirm={async () => {
                  await cancel.mutateAsync({ eventId: event.id });
                }}
              >
                <ActionIcon variant="light" color="danger" size="sm" aria-label="Annuler l'événement">
                  <IconArrowBackUp size={14} />
                </ActionIcon>
              </DeleteConfirmPopover>
            )}
          </Group>
        </Group>
      }
    >
      <Text size="xs" c="dimmed">
        {formatRpDate(event.occurredAt)}
        {event.createdByName ? ` · saisi par ${event.createdByName}` : ''}
      </Text>
      {event.note && (
        <Text size="sm" mt={4} style={{ whiteSpace: 'pre-wrap' }}>
          {event.note}
        </Text>
      )}
      {editing && <EventEditForm event={event} onDone={() => setEditing(false)} />}
    </Timeline.Item>
  );
}

type EventEditValues = { date: Date | null; endReason: EmploymentEndReason | null; note: string };

function EventEditForm({ event, onDone }: { event: EmploymentEvent; onDone: () => void }) {
  const mutation = useUpdateStaffEventMutation();
  const form = useForm<EventEditValues>({
    initialValues: { date: event.occurredAt, endReason: event.endReason, note: event.note ?? '' },
    validate: { date: (value) => (value ? null : 'La date est requise') },
  });

  const handleSubmit = async (values: EventEditValues) => {
    try {
      await mutation.mutateAsync({
        eventId: event.id,
        occurredAt: values.date ?? event.occurredAt,
        note: values.note,
        endReason: event.type === 'LEFT' ? (values.endReason ?? undefined) : undefined,
      });
      onDone();
    } catch (error: unknown) {
      if (error instanceof ParsedZodError) handleApiZodError(error.error, form);
    }
  };

  return (
    <form {...noAutofillProps} onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      <Stack gap="xs" mt="sm">
        <Group grow align="flex-start">
          <RpDateInput
            label="Date"
            size="xs"
            value={form.values.date}
            onChange={(date) => form.setFieldValue('date', date)}
            error={form.errors.date}
          />
          {event.type === 'LEFT' && (
            <Select label="Motif" size="xs" data={END_REASON_OPTIONS} {...form.getInputProps('endReason')} />
          )}
        </Group>
        <Textarea label="Note" size="xs" autosize minRows={1} maxLength={1000} {...form.getInputProps('note')} />
        <Group justify="flex-end" gap="xs">
          <Button size="xs" variant="subtle" color="slate" onClick={onDone}>
            Annuler
          </Button>
          <Button size="xs" type="submit" loading={mutation.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
