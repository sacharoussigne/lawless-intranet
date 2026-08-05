'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput, DatesProvider } from '@mantine/dates';
import 'dayjs/locale/fr';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { FormSection } from '@/app/_components/AppModal/FormSection';
import {
  confirmPlannedOccurrence,
  createPlannedTransaction,
  deletePlannedTransaction,
  getPendingOccurrences,
  getPlannedTransactions,
  skipPlannedOccurrence,
  updatePlannedTransaction,
} from '@/app/_actions/bankAccounts';
import { handleAction } from '@/lib/action';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import type {
  SerializedPlannedOccurrence,
  SerializedPlannedTransaction,
  TransactionType,
} from '@/types/bankAccounts';

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Lundi' },
  { value: '2', label: 'Mardi' },
  { value: '3', label: 'Mercredi' },
  { value: '4', label: 'Jeudi' },
  { value: '5', label: 'Vendredi' },
  { value: '6', label: 'Samedi' },
  { value: '7', label: 'Dimanche' },
];

const TYPE_OPTIONS = [
  { value: 'DEPOSIT', label: 'Dépôt' },
  { value: 'WITHDRAWAL', label: 'Retrait' },
  { value: 'TRANSFER_IN', label: 'Transfert entrant' },
  { value: 'TRANSFER_OUT', label: 'Transfert sortant' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

type BankPlannedPanelProps = {
  onChanged?: () => void;
};

function weekdayLabels(weekdays: number[]) {
  return weekdays
    .map((d) => WEEKDAY_OPTIONS.find((o) => o.value === String(d))?.label ?? String(d))
    .join(', ');
}

export function BankPlannedPanel({ onChanged }: BankPlannedPanelProps) {
  const dispensarySlug = useRequiredDispensarySlug();
  const [pending, setPending] = useState<SerializedPlannedOccurrence[]>([]);
  const [planned, setPlanned] = useState<SerializedPlannedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpened, setCreateOpened] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formType, setFormType] = useState<TransactionType>('DEPOSIT');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState<number | undefined>(undefined);
  const [formScheduleKind, setFormScheduleKind] = useState<'ONCE' | 'WEEKLY'>('WEEKLY');
  const [formOnceDate, setFormOnceDate] = useState<Date | null>(null);
  const [formWeekdays, setFormWeekdays] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [pendingResult, plannedResult] = await Promise.all([
        getPendingOccurrences(dispensarySlug),
        getPlannedTransactions(dispensarySlug),
      ]);
      const pendingData = handleAction(pendingResult);
      const plannedData = handleAction(plannedResult);
      if (pendingData) setPending(pendingData);
      if (plannedData) setPlanned(plannedData);
    } catch {
      // handled by handleAction
    } finally {
      setLoading(false);
    }
  }, [dispensarySlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const notifySuccess = (message: string) => {
    notifications.show({ title: 'Succès', message, color: 'moss' });
  };

  const notifyError = (message: string) => {
    notifications.show({ title: 'Erreur', message, color: 'danger' });
  };

  const afterMutation = async () => {
    await refresh();
    onChanged?.();
  };

  const handleConfirm = async (id: string) => {
    try {
      setLoading(true);
      const result = await confirmPlannedOccurrence(dispensarySlug, { id });
      const data = handleAction(result);
      if (data) {
        notifySuccess('Occurrence confirmée');
        await afterMutation();
      }
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Erreur lors de la confirmation');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async (id: string) => {
    try {
      setLoading(true);
      const result = await skipPlannedOccurrence(dispensarySlug, { id });
      const data = handleAction(result);
      if (data) {
        notifySuccess('Occurrence ignorée');
        await afterMutation();
      }
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Erreur lors de l'ignorance");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormType('DEPOSIT');
    setFormName('');
    setFormDescription('');
    setFormAmount(undefined);
    setFormScheduleKind('WEEKLY');
    setFormOnceDate(null);
    setFormWeekdays([]);
  };

  const handleCreate = async () => {
    if (!formName.trim() || formAmount == null || formAmount <= 0) {
      notifyError('Veuillez remplir les champs requis');
      return;
    }
    if (formScheduleKind === 'ONCE' && !formOnceDate) {
      notifyError('La date est requise pour une transaction unique');
      return;
    }
    if (formScheduleKind === 'WEEKLY' && formWeekdays.length === 0) {
      notifyError('Sélectionnez au moins un jour');
      return;
    }

    try {
      setLoading(true);
      const result = await createPlannedTransaction(dispensarySlug, {
        type: formType,
        name: formName.trim(),
        description: formDescription.trim() || null,
        amount: formAmount,
        scheduleKind: formScheduleKind,
        onceDate: formScheduleKind === 'ONCE' ? formOnceDate : null,
        weekdays:
          formScheduleKind === 'WEEKLY'
            ? formWeekdays.map((d) => Number(d))
            : undefined,
      });
      const data = handleAction(result);
      if (data) {
        notifySuccess('Transaction planifiée créée');
        setCreateOpened(false);
        resetForm();
        await afterMutation();
      }
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (item: SerializedPlannedTransaction) => {
    try {
      setLoading(true);
      const result = await updatePlannedTransaction(dispensarySlug, {
        id: item.id,
        isActive: !item.isActive,
      });
      const data = handleAction(result);
      if (data) {
        notifySuccess(item.isActive ? 'Planification désactivée' : 'Planification activée');
        await afterMutation();
      }
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      const result = await deletePlannedTransaction(dispensarySlug, { id });
      const data = handleAction(result);
      if (data) {
        notifySuccess('Planification supprimée');
        setDeleteId(null);
        await afterMutation();
      }
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DatesProvider settings={{ locale: 'fr' }}>
      <Stack gap="lg">
        <Paper shadow="sm" p="md" withBorder radius="md">
          <Stack gap="md">
            <Text fw={600} style={{ fontFamily: 'var(--disp-font-display)' }}>
              Occurrences en attente
            </Text>
            {pending.length === 0 ? (
              <Text size="sm" c="dimmed">
                Aucune occurrence en attente
              </Text>
            ) : (
              <Stack gap="sm">
                {pending.map((occurrence) => {
                  const pt = occurrence.plannedTransaction;
                  return (
                    <Paper key={occurrence.id} p="sm" withBorder radius="sm">
                      <Group justify="space-between" wrap="wrap" gap="sm">
                        <Stack gap={2}>
                          <Group gap="xs">
                            <Text fw={600} size="sm">
                              {pt.name}
                            </Text>
                            <Badge size="xs" variant="outline" color="slate">
                              {TYPE_LABELS[pt.type] ?? pt.type}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {format(new Date(occurrence.date), 'EEEE d MMMM yyyy', { locale: fr })}
                            {' · '}
                            {Number(pt.amount).toFixed(2)} $
                            {pt.description ? ` · ${pt.description}` : ''}
                          </Text>
                        </Stack>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            color="moss"
                            leftSection={<IconCheck size={14} />}
                            onClick={() => handleConfirm(occurrence.id)}
                            loading={loading}
                          >
                            Confirmer
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="slate"
                            leftSection={<IconX size={14} />}
                            onClick={() => handleSkip(occurrence.id)}
                            loading={loading}
                          >
                            Ignorer
                          </Button>
                        </Group>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Paper>

        <Paper shadow="sm" p="md" withBorder radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} style={{ fontFamily: 'var(--disp-font-display)' }}>
                Planifications
              </Text>
              <Button
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={() => setCreateOpened(true)}
              >
                Nouvelle planification
              </Button>
            </Group>

            {planned.length === 0 ? (
              <Text size="sm" c="dimmed">
                Aucune transaction planifiée
              </Text>
            ) : (
              <Stack gap="sm">
                {planned.map((item) => (
                  <Paper key={item.id} p="sm" withBorder radius="sm" opacity={item.isActive ? 1 : 0.65}>
                    <Group justify="space-between" wrap="wrap" gap="sm" align="flex-start">
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Text fw={600} size="sm">
                            {item.name}
                          </Text>
                          <Badge size="xs" variant="outline" color="slate">
                            {TYPE_LABELS[item.type] ?? item.type}
                          </Badge>
                          <Badge
                            size="xs"
                            variant="outline"
                            color={item.isActive ? 'moss' : 'slate'}
                          >
                            {item.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {Number(item.amount).toFixed(2)} $
                          {' · '}
                          {item.scheduleKind === 'ONCE'
                            ? item.onceDate
                              ? `Une fois le ${format(new Date(item.onceDate), 'dd/MM/yyyy', { locale: fr })}`
                              : 'Une fois'
                            : `Hebdo · ${weekdayLabels(item.weekdays)}`}
                          {item.description ? ` · ${item.description}` : ''}
                        </Text>
                      </Stack>
                      <Group gap="sm">
                        <Switch
                          size="sm"
                          checked={item.isActive}
                          onChange={() => handleToggleActive(item)}
                          disabled={loading}
                          label="Active"
                        />
                        <ActionIcon
                          variant="light"
                          color="danger"
                          onClick={() => setDeleteId(item.id)}
                          disabled={loading}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>

        <AppModal
          opened={createOpened}
          onClose={() => {
            setCreateOpened(false);
            resetForm();
          }}
          title="Nouvelle planification"
          description="Créez une transaction récurrente ou ponctuelle."
          size="md"
          footer={
            <AppModalFooter>
              <Button
                variant="subtle"
                color="slate"
                onClick={() => {
                  setCreateOpened(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleCreate} loading={loading}>
                Créer
              </Button>
            </AppModalFooter>
          }
        >
          <FormSection title="Transaction">
            <Select
              label="Type"
              data={TYPE_OPTIONS}
              value={formType}
              onChange={(v) => v && setFormType(v as TransactionType)}
              required
            />
            <TextInput
              label="Nom"
              value={formName}
              onChange={(e) => setFormName(e.currentTarget.value)}
              required
            />
            <Textarea
              label="Description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.currentTarget.value)}
              minRows={2}
            />
            <NumberInput
              label="Montant"
              value={formAmount}
              onChange={(v) => setFormAmount(typeof v === 'number' ? v : undefined)}
              min={0}
              decimalScale={2}
              required
            />
          </FormSection>
          <FormSection title="Planning">
            <Select
              label="Fréquence"
              data={[
                { value: 'ONCE', label: 'Une fois' },
                { value: 'WEEKLY', label: 'Hebdomadaire' },
              ]}
              value={formScheduleKind}
              onChange={(v) => v && setFormScheduleKind(v as 'ONCE' | 'WEEKLY')}
              required
            />
            {formScheduleKind === 'ONCE' ? (
              <DateInput
                label="Date"
                value={formOnceDate}
                onChange={(d) => setFormOnceDate(d as Date | null)}
                valueFormat="DD/MM/YYYY"
                required
              />
            ) : (
              <MultiSelect
                label="Jours de la semaine"
                data={WEEKDAY_OPTIONS}
                value={formWeekdays}
                onChange={setFormWeekdays}
                required
              />
            )}
          </FormSection>
        </AppModal>

        <AppModal
          opened={deleteId != null}
          onClose={() => setDeleteId(null)}
          title="Supprimer la planification"
          description="Cette action est irréversible."
          size="sm"
          footer={
            <AppModalFooter>
              <Button variant="subtle" color="slate" onClick={() => setDeleteId(null)}>
                Annuler
              </Button>
              <Button
                color="danger"
                loading={loading}
                onClick={() => deleteId && handleDelete(deleteId)}
              >
                Supprimer
              </Button>
            </AppModalFooter>
          }
        >
          <Text size="sm">Êtes-vous sûr de vouloir supprimer cette planification ?</Text>
        </AppModal>
      </Stack>
    </DatesProvider>
  );
}
