"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Container,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Popover,
  Select,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { DataTable } from "mantine-datatable";
import dayjs from "dayjs";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconBook,
  IconCalendarEvent,
  IconCheck,
  IconEdit,
  IconPlus,
  IconTransfer,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useBankUi } from "./BankUiProvider";
import { addParisWeeks } from "./bankWeek";
import { BankPlannedPanel } from "./components/BankPlannedPanel";
import { BankPendingOccurrencesBanner } from "./components/BankPendingOccurrencesBanner";
import type {
  BankActionResult,
  SerializedBankWeek,
  SerializedPlannedOccurrence,
  TransactionType,
} from "./types";

type BankPageProps = { initialWeek: SerializedBankWeek };
type TransactionDraft = {
  id?: string;
  date?: Date | string;
  type?: TransactionType;
  name?: string;
  description?: string | null;
  amount?: number;
  order?: number;
};
type TableTransaction = SerializedBankWeek["transactions"][number] & {
  isNew?: boolean;
};

const TRANSACTION_TYPES = [
  { value: "DEPOSIT", label: "Dépôt", icon: IconArrowUp, color: "green" },
  { value: "WITHDRAWAL", label: "Retrait", icon: IconArrowDown, color: "red" },
  {
    value: "TRANSFER_IN",
    label: "Transfert entrant",
    icon: IconTransfer,
    color: "blue",
  },
  {
    value: "TRANSFER_OUT",
    label: "Transfert sortant",
    icon: IconTransfer,
    color: "orange",
  },
] as const;

const isIncome = (type: TransactionType) =>
  type === "DEPOSIT" || type === "TRANSFER_IN";
const typeInfo = (type: TransactionType) =>
  TRANSACTION_TYPES.find((option) => option.value === type) ??
  TRANSACTION_TYPES[0];
function isSuccess<T>(
  result: BankActionResult<T>,
): result is { status: number; data: T } {
  return result.data !== undefined;
}
const toDateInput = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

export default function BankPage({ initialWeek }: BankPageProps) {
  const { actions } = useBankUi();
  const [activeTab, setActiveTab] = useState<string | null>("ledger");
  const [week, setWeek] = useState(initialWeek);
  const [weeks, setWeeks] = useState<SerializedBankWeek[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<
    string[]
  >([]);
  const [weekDateValue, setWeekDateValue] = useState<Date | null>(
    new Date(initialWeek.weekStart),
  );
  const [editingTransaction, setEditingTransaction] = useState<string | null>(
    null,
  );
  const [editingTransactionData, setEditingTransactionData] =
    useState<TransactionDraft | null>(null);
  const [newTransaction, setNewTransaction] = useState<TransactionDraft | null>(
    null,
  );
  const [deletePopoverOpened, setDeletePopoverOpened] = useState<string | null>(
    null,
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [pendingOccurrences, setPendingOccurrences] = useState<
    SerializedPlannedOccurrence[]
  >([]);
  const showError = (message: string) =>
    notifications.show({ title: "Erreur", message, color: "red" });
  const showSuccess = (message: string) =>
    notifications.show({ title: "Succès", message, color: "green" });

  const loadSuggestions = useCallback(async () => {
    const [names, descriptions] = await Promise.all([
      actions.getNameSuggestions(),
      actions.getDescriptionSuggestions(),
    ]);
    if (isSuccess(names)) {
      setNameSuggestions(names.data.suggestions);
      setCompanyNames(names.data.companyNames ?? []);
    } else showError(names.error);
    if (isSuccess(descriptions)) setDescriptionSuggestions(descriptions.data);
    else showError(descriptions.error);
  }, [actions]);
  const loadWeeks = useCallback(async () => {
    const result = await actions.getBankWeeks();
    if (isSuccess(result)) setWeeks(result.data);
    else showError(result.error);
  }, [actions]);
  const loadPendingOccurrences = useCallback(async () => {
    const result = await actions.getPendingOccurrences();
    if (isSuccess(result)) setPendingOccurrences(result.data);
    else showError(result.error);
  }, [actions]);
  useEffect(() => {
    void loadSuggestions();
    void loadWeeks();
    void loadPendingOccurrences();
  }, [loadSuggestions, loadWeeks, loadPendingOccurrences]);

  const loadWeek = async (date: Date) => {
    setLoading(true);
    try {
      const result = await actions.getOrCreateWeek(date);
      if (!isSuccess(result)) return showError(result.error);
      setWeek(result.data);
      setWeekDateValue(new Date(result.data.weekStart));
    } finally {
      setLoading(false);
    }
  };
  const refreshAfterPlannedChange = async () => {
    await Promise.all([
      loadWeek(new Date(week.weekStart)),
      loadWeeks(),
      loadPendingOccurrences(),
    ]);
  };
  const confirmPending = async (id: string, date: Date) => {
    setPendingLoading(true);
    try {
      const result = await actions.confirmPlannedOccurrence({ id, date });
      if (!isSuccess(result)) return showError(result.error);
      showSuccess("Transaction confirmée");
      await Promise.all([
        loadWeek(date),
        loadWeeks(),
        loadPendingOccurrences(),
      ]);
    } finally {
      setPendingLoading(false);
    }
  };
  const skipPending = async (id: string) => {
    setPendingLoading(true);
    try {
      const result = await actions.skipPlannedOccurrence({ id });
      if (!isSuccess(result)) return showError(result.error);
      showSuccess("Transaction ignorée");
      await refreshAfterPlannedChange();
    } finally {
      setPendingLoading(false);
    }
  };

  const previousWeek = useMemo(
    () =>
      weeks
        .filter((item) => new Date(item.weekStart) < new Date(week.weekStart))
        .sort((a, b) => +new Date(b.weekStart) - +new Date(a.weekStart))[0],
    [weeks, week.weekStart],
  );
  const previousBalance = previousWeek?.balance ?? 0;
  const currentBalance = useMemo(
    () =>
      week.transactions
        .slice()
        .sort(
          (a, b) => +new Date(a.date) - +new Date(b.date) || a.order - b.order,
        )
        .reduce(
          (balance, transaction) =>
            balance +
            (isIncome(transaction.type)
              ? transaction.amount
              : -transaction.amount),
          previousBalance,
        ),
    [previousBalance, week.transactions],
  );
  const weekFlow = useMemo(
    () =>
      week.transactions.reduce(
        (flow, transaction) =>
          isIncome(transaction.type)
            ? { ...flow, in: flow.in + transaction.amount }
            : { ...flow, out: flow.out + transaction.amount },
        { in: 0, out: 0 },
      ),
    [week.transactions],
  );
  const filteredTransactions = useMemo(
    () =>
      week.transactions
        .filter(
          (transaction) =>
            !typeFilter.length || typeFilter.includes(transaction.type),
        )
        .slice()
        .sort(
          (a, b) =>
            (sortOrder === "asc" ? 1 : -1) *
            (+new Date(a.date) - +new Date(b.date) || a.order - b.order),
        ),
    [week.transactions, typeFilter, sortOrder],
  );
  const records = useMemo<TableTransaction[]>(() => {
    const data = [...filteredTransactions];
    if (!newTransaction) return data;
    const draft: TableTransaction = {
      id: "new-transaction",
      weekId: week.id,
      date: newTransaction.date?.toString() ?? new Date().toISOString(),
      type: newTransaction.type ?? "DEPOSIT",
      name: newTransaction.name ?? "",
      description: newTransaction.description ?? null,
      amount: newTransaction.amount ?? 0,
      order: newTransaction.order ?? 0,
      orderId: null,
      createdAt: "",
      updatedAt: "",
      isNew: true,
    };
    return sortOrder === "desc" ? [draft, ...data] : [...data, draft];
  }, [filteredTransactions, newTransaction, sortOrder, week.id]);

  const persistSuggestions = async (
    name?: string,
    description?: string | null,
  ) => {
    if (
      name?.trim() &&
      !companyNames.some(
        (value) => value.toLowerCase() === name.trim().toLowerCase(),
      )
    ) {
      const result = await actions.addNameSuggestion({ value: name.trim() });
      if (isSuccess(result))
        setNameSuggestions((values) =>
          values.some(
            (value) => value.toLowerCase() === result.data.toLowerCase(),
          )
            ? values
            : [...values, result.data],
        );
    }
    if (description?.trim()) {
      const result = await actions.addDescriptionSuggestion({
        value: description.trim(),
      });
      if (isSuccess(result))
        setDescriptionSuggestions((values) =>
          values.some(
            (value) => value.toLowerCase() === result.data.toLowerCase(),
          )
            ? values
            : [...values, result.data],
        );
    }
  };
  const saveTransaction = async (transaction: TransactionDraft) => {
    if (
      !transaction.id &&
      (!transaction.date ||
        !transaction.type ||
        !transaction.name ||
        transaction.amount == null)
    )
      return showError("Veuillez remplir tous les champs requis");
    setLoading(true);
    try {
      const result = transaction.id
        ? await actions.updateTransaction({
            ...transaction,
            id: transaction.id,
          })
        : await actions.createTransaction({
            weekId: week.id,
            date: transaction.date!,
            type: transaction.type!,
            name: transaction.name!,
            description: transaction.description,
            amount: transaction.amount!,
            order: transaction.order,
          });
      if (!isSuccess(result)) return showError(result.error);
      await persistSuggestions(transaction.name, transaction.description);
      showSuccess(
        transaction.id ? "Transaction mise à jour" : "Transaction créée",
      );
      setEditingTransaction(null);
      setEditingTransactionData(null);
      setNewTransaction(null);
      await Promise.all([loadWeek(new Date(week.weekStart)), loadWeeks()]);
    } finally {
      setLoading(false);
    }
  };
  const deleteTransaction = async (id: string) => {
    setLoading(true);
    try {
      const result = await actions.deleteTransaction({ id });
      if (!isSuccess(result)) return showError(result.error);
      showSuccess("Transaction supprimée");
      await Promise.all([loadWeek(new Date(week.weekStart)), loadWeeks()]);
    } finally {
      setLoading(false);
    }
  };
  const reorderTransaction = async (id: string, direction: "up" | "down") => {
    const transaction = week.transactions.find((item) => item.id === id);
    if (!transaction) return;
    const sameDay = week.transactions
      .filter(
        (item) =>
          new Date(item.date).toDateString() ===
          new Date(transaction.date).toDateString(),
      )
      .sort((a, b) => a.order - b.order);
    const index = sameDay.findIndex((item) => item.id === id);
    const effectiveDirection =
      sortOrder === "desc" ? (direction === "up" ? "down" : "up") : direction;
    const target = sameDay[effectiveDirection === "up" ? index - 1 : index + 1];
    if (!target) return;
    setLoading(true);
    try {
      const result = await actions.updateTransaction({
        id,
        order: target.order,
      });
      if (!isSuccess(result)) return showError(result.error);
      showSuccess("Ordre mis à jour");
      await Promise.all([loadWeek(new Date(week.weekStart)), loadWeeks()]);
    } finally {
      setLoading(false);
    }
  };

  const autocompleteData = (suggestions: string[], extra: string[] = []) => [
    ...new Set([...suggestions, ...extra]),
  ];
  const editable = (transaction: TableTransaction) =>
    transaction.isNew || editingTransaction === transaction.id;
  const draftFor = (transaction: TableTransaction) =>
    transaction.isNew ? newTransaction : editingTransactionData;
  const setDraft = (
    transaction: TableTransaction,
    patch: Partial<TransactionDraft>,
  ) => {
    if (transaction.isNew)
      setNewTransaction((draft) => ({ ...draft, ...patch }));
    else setEditingTransactionData((draft) => ({ ...draft, ...patch }));
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Banque</Title>
          <Text c="dimmed">Livre de caisse et transactions planifiées.</Text>
        </div>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab
              value="ledger"
              leftSection={<IconBook size={16} />}
              rightSection={
                pendingOccurrences.length ? (
                  <Badge size="xs" color="yellow" circle>
                    {pendingOccurrences.length}
                  </Badge>
                ) : undefined
              }
            >
              Livre
            </Tabs.Tab>
            <Tabs.Tab
              value="planned"
              leftSection={<IconCalendarEvent size={16} />}
            >
              Planifié
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="ledger" pt="md">
            <Stack gap="lg">
              <BankPendingOccurrencesBanner
                occurrences={pendingOccurrences}
                loading={pendingLoading}
                onConfirm={(id, date) => void confirmPending(id, date)}
                onSkip={(id) => void skipPending(id)}
              />
              <Paper shadow="sm" p="lg" withBorder>
                <Stack gap="lg">
                  <Group justify="space-between" wrap="wrap">
                    <Group>
                      <ActionIcon
                        variant="light"
                        onClick={() =>
                          void loadWeek(addParisWeeks(week.weekStart, -1))
                        }
                        loading={loading}
                      >
                        <IconArrowLeft size={18} />
                      </ActionIcon>
                      <Text fw={600}>
                        {dayjs(week.weekStart).format("DD/MM/YYYY")} —{" "}
                        {dayjs(week.weekEnd).format("DD/MM/YYYY")}
                      </Text>
                      <ActionIcon
                        variant="light"
                        onClick={() =>
                          void loadWeek(addParisWeeks(week.weekStart, 1))
                        }
                        loading={loading}
                      >
                        <IconArrowRight size={18} />
                      </ActionIcon>
                    </Group>
                    <DateInput
                      value={toDateInput(weekDateValue)}
                      valueFormat="DD/MM/YYYY"
                      locale="fr"
                      onChange={(date) => date && void loadWeek(new Date(date))}
                      w={160}
                    />
                  </Group>
                  <Group grow align="stretch">
                    <Paper withBorder p="md">
                      <Text size="xs" c="dimmed">
                        Solde précédent
                      </Text>
                      <Text fw={700} size="lg">
                        {previousBalance.toFixed(2)} $
                      </Text>
                    </Paper>
                    <Paper withBorder p="md">
                      <Text size="xs" c="dimmed">
                        Solde actuel
                      </Text>
                      <Text fw={700} size="lg">
                        {currentBalance.toFixed(2)} $
                      </Text>
                    </Paper>
                    <Paper withBorder p="md">
                      <Text size="xs" c="dimmed">
                        Net de la semaine
                      </Text>
                      <Text
                        fw={700}
                        size="lg"
                        c={weekFlow.in - weekFlow.out >= 0 ? "green" : "red"}
                      >
                        {weekFlow.in - weekFlow.out >= 0 ? "+" : ""}
                        {(weekFlow.in - weekFlow.out).toFixed(2)} $
                      </Text>
                      <Text size="xs" c="dimmed">
                        Entrées {weekFlow.in.toFixed(2)} $ · Sorties{" "}
                        {weekFlow.out.toFixed(2)} $
                      </Text>
                    </Paper>
                  </Group>
                </Stack>
              </Paper>
              <Group justify="space-between">
                <Group>
                  {typeFilter.length > 0 && (
                    <>
                      <Text size="sm">Filtres :</Text>
                      {typeFilter.map((type) => (
                        <Badge
                          key={type}
                          rightSection={<IconX size={12} />}
                          onClick={() =>
                            setTypeFilter((values) =>
                              values.filter((value) => value !== type),
                            )
                          }
                        >
                          {typeInfo(type as TransactionType).label}
                        </Badge>
                      ))}
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => setTypeFilter([])}
                      >
                        Effacer
                      </Button>
                    </>
                  )}
                </Group>
                {!newTransaction && (
                  <Button
                    leftSection={<IconPlus size={18} />}
                    size="sm"
                    onClick={() =>
                      setNewTransaction({
                        date: new Date(),
                        type: "DEPOSIT",
                        name: "",
                        description: "",
                        order: week.transactions.length,
                      })
                    }
                  >
                    Ajouter une transaction
                  </Button>
                )}
              </Group>
              <Paper shadow="sm" withBorder p={0}>
                <DataTable
                  records={records}
                  fetching={loading}
                  striped
                  highlightOnHover
                  noRecordsText={
                    typeFilter.length
                      ? "Aucune transaction trouvée avec ces filtres"
                      : "Aucune transaction trouvée"
                  }
                  sortStatus={{ columnAccessor: "date", direction: sortOrder }}
                  onSortStatusChange={(status) =>
                    setSortOrder(status.direction === "asc" ? "asc" : "desc")
                  }
                  columns={[
                    {
                      accessor: "date",
                      title: "Date",
                      sortable: true,
                      render: (transaction) =>
                        editable(transaction) ? (
                          <DateInput
                            size="xs"
                            value={toDateInput(
                              draftFor(transaction)?.date ?? transaction.date,
                            )}
                            valueFormat="DD/MM/YYYY"
                            locale="fr"
                            onChange={(date) =>
                              date &&
                              setDraft(transaction, { date: new Date(date) })
                            }
                          />
                        ) : (
                          <Text size="sm">
                            {dayjs(transaction.date).format("DD/MM/YYYY")}
                          </Text>
                        ),
                    },
                    {
                      accessor: "type",
                      title: "Type",
                      filter: (
                        <MultiSelect
                          placeholder="Filtrer par type"
                          data={TRANSACTION_TYPES.map(({ value, label }) => ({
                            value,
                            label,
                          }))}
                          value={typeFilter}
                          onChange={setTypeFilter}
                          clearable
                          size="xs"
                        />
                      ),
                      render: (transaction) =>
                        editable(transaction) ? (
                          <Select
                            size="xs"
                            data={TRANSACTION_TYPES.map(({ value, label }) => ({
                              value,
                              label,
                            }))}
                            value={
                              draftFor(transaction)?.type ?? transaction.type
                            }
                            onChange={(type) =>
                              type &&
                              setDraft(transaction, {
                                type: type as TransactionType,
                              })
                            }
                          />
                        ) : (
                          (() => {
                            const info = typeInfo(transaction.type);
                            const Icon = info.icon;
                            return (
                              <Badge
                                leftSection={<Icon size={14} />}
                                color={info.color}
                                variant="light"
                              >
                                {info.label}
                              </Badge>
                            );
                          })()
                        ),
                    },
                    {
                      accessor: "name",
                      title: "Nom",
                      render: (transaction) =>
                        editable(transaction) ? (
                          <Autocomplete
                            size="xs"
                            data={autocompleteData(
                              nameSuggestions,
                              companyNames,
                            )}
                            value={
                              draftFor(transaction)?.name ?? transaction.name
                            }
                            onChange={(name) => setDraft(transaction, { name })}
                          />
                        ) : (
                          <Text size="sm">{transaction.name}</Text>
                        ),
                    },
                    {
                      accessor: "description",
                      title: "Description",
                      render: (transaction) =>
                        editable(transaction) ? (
                          <Autocomplete
                            size="xs"
                            data={descriptionSuggestions}
                            value={
                              draftFor(transaction)?.description ??
                              transaction.description ??
                              ""
                            }
                            onChange={(description) =>
                              setDraft(transaction, { description })
                            }
                          />
                        ) : (
                          <Text size="sm">
                            {transaction.description || "-"}
                          </Text>
                        ),
                    },
                    {
                      accessor: "amount",
                      title: "Montant",
                      textAlign: "right",
                      render: (transaction) =>
                        editable(transaction) ? (
                          <NumberInput
                            size="xs"
                            min={0}
                            decimalScale={2}
                            value={
                              draftFor(transaction)?.amount ??
                              transaction.amount
                            }
                            onChange={(amount) =>
                              setDraft(transaction, {
                                amount:
                                  typeof amount === "number"
                                    ? amount
                                    : undefined,
                              })
                            }
                          />
                        ) : (
                          <Text
                            size="sm"
                            fw={600}
                            c={isIncome(transaction.type) ? "green" : "red"}
                          >
                            {isIncome(transaction.type) ? "+" : "-"}
                            {transaction.amount.toFixed(2)} $
                          </Text>
                        ),
                    },
                    {
                      accessor: "actions",
                      title: "Actions",
                      textAlign: "center",
                      render: (transaction) => {
                        if (transaction.isNew)
                          return (
                            <Group gap="xs" justify="center">
                              <ActionIcon
                                color="green"
                                onClick={() =>
                                  newTransaction &&
                                  void saveTransaction(newTransaction)
                                }
                                disabled={
                                  !newTransaction?.name ||
                                  newTransaction.amount == null
                                }
                              >
                                <IconCheck size={16} />
                              </ActionIcon>
                              <ActionIcon
                                onClick={() => setNewTransaction(null)}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Group>
                          );
                        if (editingTransaction === transaction.id)
                          return (
                            <Group gap="xs" justify="center">
                              <ActionIcon
                                color="green"
                                onClick={() =>
                                  editingTransactionData &&
                                  void saveTransaction({
                                    ...editingTransactionData,
                                    id: transaction.id,
                                    date:
                                      editingTransactionData.date ??
                                      transaction.date,
                                    type:
                                      editingTransactionData.type ??
                                      transaction.type,
                                    name:
                                      editingTransactionData.name ??
                                      transaction.name,
                                    amount:
                                      editingTransactionData.amount ??
                                      transaction.amount,
                                    order:
                                      editingTransactionData.order ??
                                      transaction.order,
                                  })
                                }
                              >
                                <IconCheck size={16} />
                              </ActionIcon>
                              <ActionIcon
                                onClick={() => {
                                  setEditingTransaction(null);
                                  setEditingTransactionData(null);
                                }}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Group>
                          );
                        const sameDay = week.transactions
                          .filter(
                            (item) =>
                              new Date(item.date).toDateString() ===
                              new Date(transaction.date).toDateString(),
                          )
                          .sort((a, b) => a.order - b.order);
                        const index = sameDay.findIndex(
                          (item) => item.id === transaction.id,
                        );
                        const canUp =
                          sortOrder === "desc"
                            ? index < sameDay.length - 1
                            : index > 0;
                        const canDown =
                          sortOrder === "desc"
                            ? index > 0
                            : index < sameDay.length - 1;
                        return (
                          <Group gap="xs" justify="center">
                            {sameDay.length > 1 && (
                              <>
                                <ActionIcon
                                  variant="subtle"
                                  onClick={() =>
                                    void reorderTransaction(
                                      transaction.id,
                                      "up",
                                    )
                                  }
                                  disabled={!canUp || loading}
                                >
                                  <IconArrowUp size={16} />
                                </ActionIcon>
                                <ActionIcon
                                  variant="subtle"
                                  onClick={() =>
                                    void reorderTransaction(
                                      transaction.id,
                                      "down",
                                    )
                                  }
                                  disabled={!canDown || loading}
                                >
                                  <IconArrowDown size={16} />
                                </ActionIcon>
                              </>
                            )}
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => {
                                setEditingTransaction(transaction.id);
                                setEditingTransactionData({ ...transaction });
                              }}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                            <Popover
                              opened={deletePopoverOpened === transaction.id}
                              onChange={(opened) =>
                                setDeletePopoverOpened(
                                  opened ? transaction.id : null,
                                )
                              }
                            >
                              <Popover.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  onClick={() =>
                                    setDeletePopoverOpened(transaction.id)
                                  }
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Popover.Target>
                              <Popover.Dropdown>
                                <Stack gap="xs">
                                  <Text size="sm">
                                    Supprimer cette transaction ?
                                  </Text>
                                  <Group justify="flex-end">
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      onClick={() =>
                                        setDeletePopoverOpened(null)
                                      }
                                    >
                                      Annuler
                                    </Button>
                                    <Button
                                      size="xs"
                                      color="red"
                                      onClick={() => {
                                        void deleteTransaction(transaction.id);
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
                />
              </Paper>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="planned" pt="md">
            <BankPlannedPanel
              onChanged={() => void refreshAfterPlannedChange()}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
