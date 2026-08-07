'use client';

import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Container,
  Group,
  Button,
  Paper,
  NumberInput,
  Select,
  ActionIcon,
  Text,
  Badge,
  Stack,
  Popover,
  MultiSelect,
  Tabs,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { DatesProvider } from '@mantine/dates';
import 'dayjs/locale/fr';
import {
  IconPlus,
  IconTrash,
  IconArrowDown,
  IconArrowUp,
  IconTransfer,
  IconEdit,
  IconCheck,
  IconX,
  IconBook,
  IconCalendarEvent,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  getOrCreateWeek,
  getBankWeeks,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getNameSuggestions,
  getDescriptionSuggestions,
  addNameSuggestion,
  addDescriptionSuggestion,
  deleteNameSuggestion,
  deleteDescriptionSuggestion,
  getPendingOccurrences,
  confirmPlannedOccurrence,
  skipPlannedOccurrence,
} from '@/app/_actions/bankAccounts';
import { handleAction } from '@/lib/action';
import { addParisWeeks } from '@/lib/bankWeek';
import { formatRpDate } from '@/lib/rpCalendar';
import type { SerializedBankWeek, SerializedPlannedOccurrence } from '@/types/bankAccounts';

import { ActiveFilters } from '@/app/_components/ActiveFilters/ActiveFilters';
import { WeekNavigation } from '@/app/_components/WeekNavigation/WeekNavigation';
import { SuggestionAutocomplete } from '@/app/_components/SuggestionAutocomplete/SuggestionAutocomplete';
import { SummaryCards } from '@/app/_components/SummaryCards/SummaryCards';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { RpDateInput } from '@/app/_components/RpDatePicker/RpDateInput';
import { BankPlannedPanel } from './components/BankPlannedPanel';
import { BankPendingOccurrencesBanner } from './components/BankPendingOccurrencesBanner';

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function normalizeSerializedWeek(week: SerializedBankWeek): SerializedBankWeek {
  return {
    ...week,
    weekStart: toDate(week.weekStart as Date | string | number),
    weekEnd: toDate(week.weekEnd as Date | string | number),
    createdAt: toDate(week.createdAt as Date | string | number),
    updatedAt: toDate(week.updatedAt as Date | string | number),
    transactions: week.transactions.map((t) => ({
      ...t,
      date: toDate(t.date as Date | string | number),
      createdAt: toDate(t.createdAt as Date | string | number),
      updatedAt: toDate(t.updatedAt as Date | string | number),
    })),
  };
}

interface BankPageClientProps {
  initialWeek: SerializedBankWeek;
}

const transactionTypeOptions = [
  { value: 'DEPOSIT', label: 'Dépôt', icon: IconArrowUp, color: 'moss' },
  { value: 'WITHDRAWAL', label: 'Retrait', icon: IconArrowDown, color: 'danger' },
  { value: 'TRANSFER_IN', label: 'Transfert entrant', icon: IconTransfer, color: 'denim' },
  { value: 'TRANSFER_OUT', label: 'Transfert sortant', icon: IconTransfer, color: 'clay' },
];

const getTransactionTypeInfo = (type: string) => {
  return transactionTypeOptions.find((opt) => opt.value === type) || transactionTypeOptions[0];
};

export default function BankPageClient({
  initialWeek,
}: BankPageClientProps) {
  const dispensarySlug = useRequiredDispensarySlug();
  const [activeTab, setActiveTab] = useState<string | null>('ledger');
  const [week, setWeek] = useState<SerializedBankWeek>(() => normalizeSerializedWeek(initialWeek));
  const [weeks, setWeeks] = useState<SerializedBankWeek[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([]);
  const [weekDateValue, setWeekDateValue] = useState<Date | null>(() =>
    new Date(normalizeSerializedWeek(initialWeek).weekStart),
  );
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editingTransactionData, setEditingTransactionData] = useState<{
    date?: Date | string;
    type?: string;
    name?: string;
    description?: string;
    amount?: number;
    order?: number;
  } | null>(null);
  const [newTransaction, setNewTransaction] = useState<{
    date?: Date | string;
    type?: string;
    name?: string;
    description?: string;
    amount?: number;
    order?: number;
  } | null>(null);
  const [deletePopoverOpened, setDeletePopoverOpened] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [pendingOccurrences, setPendingOccurrences] = useState<SerializedPlannedOccurrence[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const loadSuggestions = useCallback(async () => {
    try {
      const [nameResult, descResult] = await Promise.all([
        getNameSuggestions(dispensarySlug),
        getDescriptionSuggestions(dispensarySlug),
      ]);
      const nameData = handleAction(nameResult);
      const descData = handleAction(descResult);
      if (nameData) {
        setNameSuggestions(nameData.suggestions);
        setCompanyNames(nameData.companyNames);
      }
      if (descData) setDescriptionSuggestions(descData);
    } catch {
      // Error handled by handleAction
    }
  }, [dispensarySlug]);

  const loadWeeks = useCallback(async () => {
    try {
      const result = await getBankWeeks(dispensarySlug);
      const data = handleAction(result);
      if (data) {
        setWeeks(data.map(normalizeSerializedWeek));
      }
    } catch {
      // Error handled by handleAction
    }
  }, [dispensarySlug]);

  const loadPendingOccurrences = useCallback(async () => {
    try {
      const result = await getPendingOccurrences(dispensarySlug);
      const data = handleAction(result);
      if (data) setPendingOccurrences(data);
    } catch {
      // Error handled by handleAction
    }
  }, [dispensarySlug]);

  useEffect(() => {
    void loadSuggestions();
    void loadWeeks();
    void loadPendingOccurrences();
  }, [loadSuggestions, loadWeeks, loadPendingOccurrences]);

  const handleAddNameSuggestion = async (value: string) => {
    if (!value || value.trim().length === 0) return;

    try {
      const result = await addNameSuggestion(dispensarySlug, { value });
      const data = handleAction(result);
      if (data) {
        setNameSuggestions((prev) =>
          prev.some((s) => s.toLowerCase() === data.toLowerCase()) ? prev : [...prev, data],
        );
        notifications.show({
          title: 'Succès',
          message: 'Suggestion ajoutée',
          color: 'moss',
        });
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : "Erreur lors de l'ajout de la suggestion",
        color: 'danger',
      });
    }
  };

  const handleAddDescriptionSuggestion = async (value: string) => {
    if (!value || value.trim().length === 0) return;

    try {
      const result = await addDescriptionSuggestion(dispensarySlug, { value });
      const data = handleAction(result);
      if (data) {
        setDescriptionSuggestions((prev) => [...prev, data]);
        notifications.show({
          title: 'Succès',
          message: 'Suggestion ajoutée',
          color: 'moss',
        });
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : "Erreur lors de l'ajout de la suggestion",
        color: 'danger',
      });
    }
  };

  const handleDeleteNameSuggestion = async (value: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!value || value.trim().length === 0) return;

    const trimmed = value.trim();
    try {
      const result = await deleteNameSuggestion(dispensarySlug, { value: trimmed });
      handleAction(result);
      setNameSuggestions((prev) =>
        prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
      );
      notifications.show({
        title: 'Succès',
        message: 'Suggestion supprimée',
        color: 'moss',
      });
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message:
          error instanceof Error ? error.message : 'Erreur lors de la suppression de la suggestion',
        color: 'danger',
      });
    }
  };

  const handleDeleteDescriptionSuggestion = async (value: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!value || value.trim().length === 0) return;

    const trimmed = value.trim();
    try {
      const result = await deleteDescriptionSuggestion(dispensarySlug, { value: trimmed });
      handleAction(result);
      setDescriptionSuggestions((prev) =>
        prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
      );
      notifications.show({
        title: 'Succès',
        message: 'Suggestion supprimée',
        color: 'moss',
      });
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message:
          error instanceof Error ? error.message : 'Erreur lors de la suppression de la suggestion',
        color: 'danger',
      });
    }
  };

  const loadWeek = async (date: Date) => {
    try {
      setLoading(true);
      const result = await getOrCreateWeek(dispensarySlug, date);
      const data = handleAction(result);
      if (data) {
        const normalized = normalizeSerializedWeek(data);
        setWeek(normalized);
        setWeekDateValue(new Date(normalized.weekStart));
      } else {
        notifications.show({
          title: 'Erreur',
          message: 'Impossible de charger cette semaine.',
          color: 'danger',
        });
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors du chargement de la semaine',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAfterPlannedChange = async () => {
    await Promise.all([loadWeek(week.weekStart), loadWeeks(), loadPendingOccurrences()]);
  };

  const handleConfirmPending = async (id: string, date: Date) => {
    try {
      setPendingLoading(true);
      const result = await confirmPlannedOccurrence(dispensarySlug, { id, date });
      const data = handleAction(result);
      if (data) {
        notifications.show({
          title: 'Succès',
          message: 'Transaction confirmée',
          color: 'moss',
        });
        await Promise.all([loadWeek(date), loadWeeks(), loadPendingOccurrences()]);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de la confirmation',
        color: 'danger',
      });
    } finally {
      setPendingLoading(false);
    }
  };

  const handleSkipPending = async (id: string) => {
    try {
      setPendingLoading(true);
      const result = await skipPlannedOccurrence(dispensarySlug, { id });
      const data = handleAction(result);
      if (data) {
        notifications.show({
          title: 'Succès',
          message: 'Transaction ignorée',
          color: 'moss',
        });
        await refreshAfterPlannedChange();
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : "Erreur lors de l'ignorance",
        color: 'danger',
      });
    } finally {
      setPendingLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    void loadWeek(addParisWeeks(week.weekStart, -1));
  };

  const handleNextWeek = () => {
    void loadWeek(addParisWeeks(week.weekStart, 1));
  };

  const handleWeekChange = async (date: Date | null) => {
    if (date) {
      await loadWeek(date);
    }
  };

  const previousWeek = useMemo(() => {
    const currentStart = toDate(week.weekStart).getTime();
    return weeks
      .filter((w) => toDate(w.weekStart).getTime() < currentStart)
      .sort((a, b) => toDate(b.weekStart).getTime() - toDate(a.weekStart).getTime())[0];
  }, [weeks, week.weekStart]);

  const previousBalance = previousWeek ? Number(previousWeek.balance) : 0;

  const currentBalance = useMemo(() => {
    let runningBalance = previousBalance;

    const sortedAllTransactions = [...week.transactions].sort((a, b) => {
      const dateA = new Date(a.date);
      dateA.setHours(0, 0, 0, 0);
      const dateATime = dateA.getTime();

      const dateB = new Date(b.date);
      dateB.setHours(0, 0, 0, 0);
      const dateBTime = dateB.getTime();

      if (dateATime !== dateBTime) {
        return dateATime - dateBTime;
      }

      return a.order - b.order;
    });

    for (const transaction of sortedAllTransactions) {
      const amount = Number(transaction.amount);
      if (transaction.type === 'DEPOSIT' || transaction.type === 'TRANSFER_IN') {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
    }

    return runningBalance;
  }, [week.transactions, previousBalance]);

  const weekFlow = useMemo(() => {
    let weekIn = 0;
    let weekOut = 0;
    for (const transaction of week.transactions) {
      const amount = Number(transaction.amount);
      if (transaction.type === 'DEPOSIT' || transaction.type === 'TRANSFER_IN') {
        weekIn += amount;
      } else {
        weekOut += amount;
      }
    }
    return { weekIn, weekOut, weekNet: weekIn - weekOut };
  }, [week.transactions]);

  const filteredTransactions = useMemo(() => {
    let transactions = week.transactions;
    if (typeFilter.length > 0) {
      transactions = week.transactions.filter((t) => typeFilter.includes(t.type));
    }

    return [...transactions].sort((a, b) => {
      const dateA = new Date(a.date);
      dateA.setHours(0, 0, 0, 0);
      const dateATime = dateA.getTime();

      const dateB = new Date(b.date);
      dateB.setHours(0, 0, 0, 0);
      const dateBTime = dateB.getTime();

      if (dateATime !== dateBTime) {
        return sortOrder === 'asc' ? dateATime - dateBTime : dateBTime - dateATime;
      }

      return sortOrder === 'asc' ? a.order - b.order : b.order - a.order;
    });
  }, [week.transactions, sortOrder, typeFilter]);

  const dataTableRecords = useMemo(() => {
    const records = [...filteredTransactions];

    if (newTransaction) {
      const newRecord = {
        id: 'new-transaction',
        isNew: true,
        date: newTransaction.date || new Date(),
        type: newTransaction.type || 'DEPOSIT',
        name: newTransaction.name || '',
        description: newTransaction.description || null,
        amount: newTransaction.amount || 0,
        order: newTransaction.order || 0,
      };

      if (sortOrder === 'desc') {
        records.unshift(newRecord as (typeof records)[number] & { isNew: boolean });
      } else {
        records.push(newRecord as (typeof records)[number] & { isNew: boolean });
      }
    }

    return records;
  }, [filteredTransactions, newTransaction, sortOrder]);

  const { weekIn, weekOut, weekNet } = weekFlow;

  const persistFreeTextSuggestions = async (name?: string, description?: string | null) => {
    const trimmedName = name?.trim();
    if (
      trimmedName &&
      !companyNames.some((c) => c.toLowerCase() === trimmedName.toLowerCase())
    ) {
      try {
        const result = await addNameSuggestion(dispensarySlug, { value: trimmedName });
        const data = handleAction(result);
        if (data) {
          setNameSuggestions((prev) =>
            prev.some((s) => s.toLowerCase() === data.toLowerCase()) ? prev : [...prev, data],
          );
        }
      } catch {
        // Non-blocking
      }
    }

    const trimmedDescription = description?.trim();
    if (trimmedDescription) {
      try {
        const result = await addDescriptionSuggestion(dispensarySlug, {
          value: trimmedDescription,
        });
        const data = handleAction(result);
        if (data) {
          setDescriptionSuggestions((prev) =>
            prev.some((s) => s.toLowerCase() === data.toLowerCase()) ? prev : [...prev, data],
          );
        }
      } catch {
        // Non-blocking
      }
    }
  };

  const handleSaveTransaction = async (transaction: {
    id?: string;
    date?: Date | string;
    type?: string;
    name?: string;
    description?: string | null;
    amount?: number;
    order?: number;
  }) => {
    try {
      setLoading(true);
      if (transaction.id) {
        const result = await updateTransaction(dispensarySlug, {
          id: transaction.id,
          date: transaction.date,
          type: transaction.type as 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT',
          name: transaction.name,
          description: transaction.description || undefined,
          amount: transaction.amount,
          order: transaction.order,
        });
        const data = handleAction(result);
        if (data) {
          notifications.show({
            title: 'Succès',
            message: 'Transaction mise à jour',
            color: 'moss',
          });
          await persistFreeTextSuggestions(transaction.name, transaction.description);
          await loadWeek(week.weekStart);
          await loadWeeks();
          setEditingTransaction(null);
        }
      } else {
        if (!transaction.date || !transaction.type || !transaction.name || transaction.amount == null) {
          notifications.show({
            title: 'Erreur',
            message: 'Veuillez remplir tous les champs requis',
            color: 'danger',
          });
          return;
        }

        const result = await createTransaction(dispensarySlug, {
          weekId: week.id,
          date: transaction.date as Date | string,
          type: transaction.type as 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT',
          name: transaction.name,
          description: transaction.description || undefined,
          amount: transaction.amount,
          order: transaction.order || 0,
        });
        const data = handleAction(result);
        if (data) {
          notifications.show({
            title: 'Succès',
            message: 'Transaction créée',
            color: 'moss',
          });
          await persistFreeTextSuggestions(transaction.name, transaction.description);
          await loadWeek(week.weekStart);
          await loadWeeks();
          setNewTransaction(null);
        }
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      setLoading(true);
      const result = await deleteTransaction(dispensarySlug, { id });
      const data = handleAction(result);
      if (data) {
        notifications.show({
          title: 'Succès',
          message: 'Transaction supprimée',
          color: 'moss',
        });
        await loadWeek(week.weekStart);
        await loadWeeks();
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de la suppression',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReorderTransaction = async (transactionId: string, direction: 'up' | 'down') => {
    try {
      setLoading(true);

      const transaction = week.transactions.find((t) => t.id === transactionId);
      if (!transaction) return;

      const transactionDate = new Date(transaction.date);
      transactionDate.setHours(0, 0, 0, 0);

      const sameDateTransactions = week.transactions.filter((t) => {
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0);
        return tDate.getTime() === transactionDate.getTime();
      });

      if (sameDateTransactions.length < 2) {
        return;
      }

      const sortedSameDate = [...sameDateTransactions].sort((a, b) => a.order - b.order);
      const currentIndex = sortedSameDate.findIndex((t) => t.id === transactionId);

      const actualDirection =
        sortOrder === 'desc' ? (direction === 'up' ? 'down' : 'up') : direction;

      if (actualDirection === 'up' && currentIndex === 0) {
        return;
      }

      if (actualDirection === 'down' && currentIndex === sortedSameDate.length - 1) {
        return;
      }

      const targetIndex = actualDirection === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetTransaction = sortedSameDate[targetIndex];
      const newOrder = targetTransaction.order;

      const result = await updateTransaction(dispensarySlug, {
        id: transactionId,
        order: newOrder,
      });
      const data = handleAction(result);
      if (data) {
        notifications.show({
          title: 'Succès',
          message: 'Ordre mis à jour',
          color: 'moss',
        });
        await loadWeek(week.weekStart);
        await loadWeeks();
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors du réordonnancement',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <PageHeader
          title="Banque"
          description="Livre de caisse et transactions planifiées du dispensaire."
        />

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab
              value="ledger"
              leftSection={<IconBook size={16} />}
              rightSection={
                pendingOccurrences.length > 0 ? (
                  <Badge size="xs" color="amber" circle variant="filled">
                    {pendingOccurrences.length}
                  </Badge>
                ) : undefined
              }
            >
              Livre
            </Tabs.Tab>
            <Tabs.Tab value="planned" leftSection={<IconCalendarEvent size={16} />}>
              Planifié
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="ledger" pt="md">
            <Stack gap="lg">
              <BankPendingOccurrencesBanner
                occurrences={pendingOccurrences}
                loading={pendingLoading}
                onConfirm={handleConfirmPending}
                onSkip={handleSkipPending}
              />
              <Paper shadow="sm" p="lg" withBorder radius="md">
                <Stack gap="lg">
                  <WeekNavigation
                    weekStart={week.weekStart}
                    weekEnd={week.weekEnd}
                    weekDateValue={weekDateValue}
                    onWeekChange={handleWeekChange}
                    onPreviousWeek={handlePreviousWeek}
                    onNextWeek={handleNextWeek}
                    loading={loading}
                    useRpCalendar
                  />

                  <SummaryCards
                    cards={[
                      {
                        label: 'Solde précédent',
                        value: previousBalance,
                        color: 'slate',
                        backgroundColor: 'var(--mantine-color-slate-0)',
                      },
                      {
                        label: 'Solde actuel',
                        value: currentBalance,
                        color: 'leather',
                        backgroundColor: 'var(--mantine-color-leather-0)',
                      },
                      {
                        label: 'Net de la semaine',
                        value: weekNet,
                        color: weekNet >= 0 ? 'moss' : 'danger',
                        backgroundColor:
                          weekNet >= 0
                            ? 'var(--mantine-color-moss-0)'
                            : 'var(--mantine-color-danger-0)',
                        formatValue: (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)} $`,
                        detail: `Entrées ${weekIn.toFixed(2)} $ · Sorties ${weekOut.toFixed(2)} $`,
                      },
                    ]}
                  />
                </Stack>
              </Paper>

              <DatesProvider settings={{ locale: 'fr' }}>
                <ActiveFilters
                  filters={[
                    {
                      label: 'Type',
                      value: typeFilter.length > 0 ? typeFilter.join(', ') : null,
                      onRemove: () => setTypeFilter([]),
                      displayValue:
                        typeFilter.length > 0
                          ? typeFilter
                              .map((type) => {
                                const typeInfo = transactionTypeOptions.find(
                                  (opt) => opt.value === type,
                                );
                                return typeInfo ? typeInfo.label : type;
                              })
                              .join(', ')
                          : undefined,
                    },
                  ]}
                />
                <Stack gap="sm">
                  {!newTransaction && (
                    <Group justify="flex-end">
                      <Button
                        leftSection={<IconPlus size={18} />}
                        onClick={() => {
                          setNewTransaction({
                            date: new Date(),
                            type: 'DEPOSIT',
                            name: '',
                            description: '',
                            amount: undefined,
                            order: week.transactions.length,
                          });
                        }}
                        size="sm"
                        radius="md"
                      >
                        Ajouter une transaction
                      </Button>
                    </Group>
                  )}
                  <Paper shadow="sm" withBorder radius="md" p={0}>
                  <DataTable
                    records={dataTableRecords}
                    columns={[
                      {
                        accessor: 'date',
                        title: 'Date',
                        sortable: true,
                        render: (transaction: (typeof dataTableRecords)[number] & { isNew?: boolean }) => {
                          const isNew = Boolean(transaction.isNew);
                          const isEditing = !isNew && editingTransaction === transaction.id;

                          if (isNew) {
                            return (
                              <RpDateInput
                                value={
                                  newTransaction?.date
                                    ? new Date(newTransaction.date)
                                    : new Date()
                                }
                                onChange={(date) => {
                                  if (date && newTransaction) {
                                    setNewTransaction({
                                      ...newTransaction,
                                      date,
                                    });
                                  }
                                }}
                                size="xs"
                              />
                            );
                          }

                          if (isEditing) {
                            return (
                              <RpDateInput
                                value={
                                  editingTransactionData?.date
                                    ? new Date(editingTransactionData.date)
                                    : new Date(transaction.date)
                                }
                                onChange={(date) => {
                                  if (date && editingTransactionData) {
                                    setEditingTransactionData({
                                      ...editingTransactionData,
                                      date,
                                    });
                                  }
                                }}
                                size="xs"
                              />
                            );
                          }

                          return (
                            <Text size="sm">
                              {formatRpDate(new Date(transaction.date), 'dd/MM/yyyy')}
                            </Text>
                          );
                        },
                      },
                      {
                        accessor: 'type',
                        title: 'Type',
                        sortable: false,
                        filter: (
                          <MultiSelect
                            placeholder="Filtrer par type"
                            data={transactionTypeOptions.map((opt) => ({
                              value: opt.value,
                              label: opt.label,
                            }))}
                            value={typeFilter}
                            onChange={setTypeFilter}
                            clearable
                            style={{ minWidth: 200 }}
                            size="xs"
                          />
                        ),
                        render: (transaction: (typeof dataTableRecords)[number] & { isNew?: boolean }) => {
                          const isNew = Boolean(transaction.isNew);
                          const isEditing = !isNew && editingTransaction === transaction.id;

                          if (isNew) {
                            return (
                              <Select
                                data={transactionTypeOptions.map((opt) => ({
                                  value: opt.value,
                                  label: opt.label,
                                }))}
                                value={newTransaction?.type}
                                onChange={(value) => {
                                  if (value && newTransaction) {
                                    setNewTransaction({ ...newTransaction, type: value });
                                  }
                                }}
                                size="xs"
                                placeholder="Type"
                              />
                            );
                          }

                          if (isEditing) {
                            return (
                              <Select
                                data={transactionTypeOptions.map((opt) => ({
                                  value: opt.value,
                                  label: opt.label,
                                }))}
                                value={editingTransactionData?.type || transaction.type}
                                onChange={(value) => {
                                  if (value && editingTransactionData) {
                                    setEditingTransactionData({
                                      ...editingTransactionData,
                                      type: value,
                                    });
                                  }
                                }}
                                size="xs"
                              />
                            );
                          }

                          const typeInfo = getTransactionTypeInfo(transaction.type);
                          const IconComponent = typeInfo.icon;
                          return (
                            <Badge
                              leftSection={<IconComponent size={14} />}
                              color={typeInfo.color}
                              variant="light"
                              size="sm"
                            >
                              {typeInfo.label}
                            </Badge>
                          );
                        },
                      },
                      {
                        accessor: 'name',
                        title: 'Nom',
                        sortable: false,
                        render: (transaction: (typeof dataTableRecords)[number] & { isNew?: boolean }) => {
                          const isNew = Boolean(transaction.isNew);
                          const isEditing = !isNew && editingTransaction === transaction.id;

                          if (isNew) {
                            return (
                              <SuggestionAutocomplete
                                value={newTransaction?.name || ''}
                                onChange={(value) => {
                                  if (newTransaction) {
                                    setNewTransaction({ ...newTransaction, name: value });
                                  }
                                }}
                                suggestions={nameSuggestions}
                                extraOptions={companyNames}
                                onAddSuggestion={handleAddNameSuggestion}
                                onDeleteSuggestion={handleDeleteNameSuggestion}
                                placeholder="Nom"
                                size="xs"
                              />
                            );
                          }

                          if (isEditing) {
                            return (
                              <SuggestionAutocomplete
                                value={editingTransactionData?.name || transaction.name}
                                onChange={(value) => {
                                  if (editingTransactionData) {
                                    setEditingTransactionData({
                                      ...editingTransactionData,
                                      name: value,
                                    });
                                  }
                                }}
                                suggestions={nameSuggestions}
                                extraOptions={companyNames}
                                onAddSuggestion={handleAddNameSuggestion}
                                onDeleteSuggestion={handleDeleteNameSuggestion}
                                size="xs"
                              />
                            );
                          }

                          return <Text size="sm">{transaction.name}</Text>;
                        },
                      },
                      {
                        accessor: 'description',
                        title: 'Description',
                        sortable: false,
                        render: (transaction: (typeof dataTableRecords)[number] & { isNew?: boolean }) => {
                          const isNew = Boolean(transaction.isNew);
                          const isEditing = !isNew && editingTransaction === transaction.id;

                          if (isNew) {
                            return (
                              <SuggestionAutocomplete
                                value={newTransaction?.description || ''}
                                onChange={(value) => {
                                  if (newTransaction) {
                                    setNewTransaction({
                                      ...newTransaction,
                                      description: value || undefined,
                                    });
                                  }
                                }}
                                suggestions={descriptionSuggestions}
                                onAddSuggestion={handleAddDescriptionSuggestion}
                                onDeleteSuggestion={handleDeleteDescriptionSuggestion}
                                placeholder="Description"
                                size="xs"
                              />
                            );
                          }

                          if (isEditing) {
                            return (
                              <SuggestionAutocomplete
                                value={
                                  editingTransactionData?.description ||
                                  transaction.description ||
                                  ''
                                }
                                onChange={(value) => {
                                  if (editingTransactionData) {
                                    setEditingTransactionData({
                                      ...editingTransactionData,
                                      description: value || undefined,
                                    });
                                  }
                                }}
                                suggestions={descriptionSuggestions}
                                onAddSuggestion={handleAddDescriptionSuggestion}
                                onDeleteSuggestion={handleDeleteDescriptionSuggestion}
                                size="xs"
                              />
                            );
                          }

                          return <Text size="sm">{transaction.description || '-'}</Text>;
                        },
                      },
                      {
                        accessor: 'amount',
                        title: 'Montant',
                        textAlign: 'right',
                        sortable: false,
                        render: (transaction: (typeof dataTableRecords)[number] & { isNew?: boolean }) => {
                          const isNew = Boolean(transaction.isNew);
                          const isEditing = !isNew && editingTransaction === transaction.id;

                          if (isNew) {
                            return (
                              <NumberInput
                                value={
                                  newTransaction?.amount
                                    ? Number(newTransaction.amount)
                                    : undefined
                                }
                                onChange={(value) => {
                                  if (newTransaction) {
                                    setNewTransaction({
                                      ...newTransaction,
                                      amount: value ? Number(value) : undefined,
                                    });
                                  }
                                }}
                                size="xs"
                                min={0}
                                decimalScale={2}
                                placeholder="0.00"
                                style={{ width: '100%' }}
                              />
                            );
                          }

                          if (isEditing) {
                            return (
                              <NumberInput
                                value={
                                  editingTransactionData?.amount !== undefined
                                    ? Number(editingTransactionData.amount)
                                    : Number(transaction.amount)
                                }
                                onChange={(value) => {
                                  if (editingTransactionData) {
                                    setEditingTransactionData({
                                      ...editingTransactionData,
                                      amount: value ? Number(value) : undefined,
                                    });
                                  }
                                }}
                                size="xs"
                                min={0}
                                decimalScale={2}
                                style={{ width: '100%' }}
                              />
                            );
                          }

                          return (
                            <Text
                              size="sm"
                              fw={600}
                              c={
                                transaction.type === 'DEPOSIT' ||
                                transaction.type === 'TRANSFER_IN'
                                  ? 'moss'
                                  : 'danger'
                              }
                            >
                              {(transaction.type === 'DEPOSIT' ||
                              transaction.type === 'TRANSFER_IN'
                                ? '+'
                                : '-') + Number(transaction.amount).toFixed(2)}{' '}
                              $
                            </Text>
                          );
                        },
                      },
                      {
                        accessor: 'actions',
                        title: 'Actions',
                        textAlign: 'center',
                        sortable: false,
                        render: (transaction: (typeof dataTableRecords)[number] & { isNew?: boolean }) => {
                          const isNew = Boolean(transaction.isNew);
                          const isEditing = !isNew && editingTransaction === transaction.id;

                          if (isNew) {
                            return (
                              <Group gap="xs" justify="center" wrap="nowrap">
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="moss"
                                  onClick={() => {
                                    if (newTransaction) {
                                      void handleSaveTransaction(newTransaction);
                                    }
                                  }}
                                  disabled={
                                    !newTransaction?.date ||
                                    !newTransaction?.type ||
                                    !newTransaction?.name ||
                                    !newTransaction?.amount
                                  }
                                >
                                  <IconCheck size={18} />
                                </ActionIcon>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="slate"
                                  onClick={() => setNewTransaction(null)}
                                >
                                  <IconX size={18} />
                                </ActionIcon>
                              </Group>
                            );
                          }

                          if (isEditing) {
                            return (
                              <Group gap="xs" justify="center" wrap="nowrap">
                                <ActionIcon
                                  color="moss"
                                  variant="light"
                                  onClick={() => {
                                    if (editingTransactionData) {
                                      void handleSaveTransaction({
                                        id: transaction.id,
                                        date:
                                          editingTransactionData.date || transaction.date,
                                        type:
                                          editingTransactionData.type || transaction.type,
                                        name:
                                          editingTransactionData.name || transaction.name,
                                        description:
                                          editingTransactionData.description !== undefined
                                            ? editingTransactionData.description
                                            : transaction.description || null,
                                        amount:
                                          editingTransactionData.amount !== undefined
                                            ? editingTransactionData.amount
                                            : Number(transaction.amount),
                                        order:
                                          editingTransactionData.order !== undefined
                                            ? editingTransactionData.order
                                            : transaction.order,
                                      });
                                    }
                                  }}
                                >
                                  <IconCheck size={16} />
                                </ActionIcon>
                                <ActionIcon
                                  color="slate"
                                  variant="light"
                                  onClick={() => {
                                    setEditingTransaction(null);
                                    setEditingTransactionData(null);
                                  }}
                                >
                                  <IconX size={16} />
                                </ActionIcon>
                              </Group>
                            );
                          }

                          const transactionDate = new Date(transaction.date);
                          transactionDate.setHours(0, 0, 0, 0);

                          const sameDateTransactions = week.transactions.filter((t) => {
                            const tDate = new Date(t.date);
                            tDate.setHours(0, 0, 0, 0);
                            return tDate.getTime() === transactionDate.getTime();
                          });

                          const sortedSameDate = [...sameDateTransactions].sort(
                            (a, b) => a.order - b.order,
                          );
                          const currentIndex = sortedSameDate.findIndex(
                            (t) => t.id === transaction.id,
                          );

                          const canMoveUpInOrder = currentIndex > 0;
                          const canMoveDownInOrder =
                            currentIndex < sortedSameDate.length - 1;

                          const canMoveUp =
                            sortOrder === 'desc' ? canMoveDownInOrder : canMoveUpInOrder;
                          const canMoveDown =
                            sortOrder === 'desc' ? canMoveUpInOrder : canMoveDownInOrder;

                          return (
                            <Group gap="xs" justify="center" wrap="nowrap">
                              {sameDateTransactions.length >= 2 && (
                                <>
                                  <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    color="slate"
                                    onClick={() =>
                                      void handleReorderTransaction(transaction.id, 'up')
                                    }
                                    disabled={!canMoveUp || loading || isEditing}
                                    title={sortOrder === 'desc' ? 'Descendre' : 'Monter'}
                                  >
                                    <IconArrowUp size={16} />
                                  </ActionIcon>
                                  <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    color="slate"
                                    onClick={() =>
                                      void handleReorderTransaction(transaction.id, 'down')
                                    }
                                    disabled={!canMoveDown || loading || isEditing}
                                    title={sortOrder === 'desc' ? 'Monter' : 'Descendre'}
                                  >
                                    <IconArrowDown size={16} />
                                  </ActionIcon>
                                </>
                              )}
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                color="denim"
                                onClick={() => {
                                  setEditingTransaction(transaction.id);
                                  setEditingTransactionData({
                                    date: transaction.date,
                                    type: transaction.type,
                                    name: transaction.name,
                                    description: transaction.description
                                      ? transaction.description
                                      : undefined,
                                    amount: Number(transaction.amount),
                                    order: transaction.order,
                                  });
                                }}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                              <Popover
                                position="top"
                                withArrow
                                shadow="md"
                                opened={deletePopoverOpened === transaction.id}
                                onChange={(opened) =>
                                  setDeletePopoverOpened(opened ? transaction.id : null)
                                }
                              >
                                <Popover.Target>
                                  <ActionIcon
                                    color="danger"
                                    variant="subtle"
                                    size="sm"
                                    onClick={() => setDeletePopoverOpened(transaction.id)}
                                    disabled={loading || isEditing}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Popover.Target>
                                <Popover.Dropdown>
                                  <Stack gap="xs" p="xs">
                                    <Text size="sm" fw={500}>
                                      Confirmer la suppression
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      Êtes-vous sûr de vouloir supprimer cette transaction ?
                                    </Text>
                                    <Group gap="xs" justify="flex-end" mt="xs">
                                      <Button
                                        size="xs"
                                        variant="subtle"
                                        color="slate"
                                        onClick={() => setDeletePopoverOpened(null)}
                                      >
                                        Annuler
                                      </Button>
                                      <Button
                                        size="xs"
                                        color="danger"
                                        onClick={() => {
                                          void handleDeleteTransaction(transaction.id);
                                          setDeletePopoverOpened(null);
                                        }}
                                      >
                                        Supprimer
                                      </Button>
                                    </Group>
                                  </Stack>
                                </Popover.Dropdown>
                              </Popover>
                            </Group>
                          );
                        },
                      },
                    ]}
                    striped
                    highlightOnHover
                    fetching={loading}
                    noRecordsText={
                      typeFilter.length > 0
                        ? 'Aucune transaction trouvée avec ces filtres'
                        : 'Aucune transaction trouvée'
                    }
                    sortStatus={{
                      columnAccessor: 'date',
                      direction: sortOrder,
                    }}
                    onSortStatusChange={(status) => {
                      if (status) {
                        setSortOrder(status.direction === 'asc' ? 'asc' : 'desc');
                      }
                    }}
                  />
                  </Paper>
                </Stack>
              </DatesProvider>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="planned" pt="md">
            <BankPlannedPanel onChanged={refreshAfterPlannedChange} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
