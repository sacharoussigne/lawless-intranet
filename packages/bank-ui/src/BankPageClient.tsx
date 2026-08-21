"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
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
import { notifications } from "@mantine/notifications";
import { DataTable } from "mantine-datatable";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconBook,
  IconCalendarEvent,
  IconCheck,
  IconEdit,
  IconFileImport,
  IconPlus,
  IconReceipt,
  IconTransfer,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useBankUi } from "./BankUiProvider";
import { addParisWeeks } from "./bankWeek";
import { BankPlannedPanel } from "./components/BankPlannedPanel";
import { BankPendingOccurrencesBanner } from "./components/BankPendingOccurrencesBanner";
import { DataTableEmptyState } from "./components/DataTableEmptyState";
import { ImportTransactionsModal } from "./components/ImportTransactionsModal";
import { RpDateInput } from "./components/RpDateInput";
import { SuggestionAutocomplete } from "./components/SuggestionAutocomplete";
import {
  apothecaryPillStyle,
  clayPalette,
  dangerPalette,
  denimPalette,
  mossPalette,
} from "./lib/apothecaryPill";
import { formatRpDay, formatRpLongDay } from "./rpCalendar";
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
  amount?: number | string;
  order?: number;
};
type TableTransaction = SerializedBankWeek["transactions"][number] & {
  isNew?: boolean;
};

const parseAmount = (
  value: number | string | null | undefined,
): number | undefined => {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const TRANSACTION_TYPES = [
  {
    value: "DEPOSIT",
    label: "Dépôt",
    icon: IconArrowUp,
    palette: mossPalette,
  },
  {
    value: "WITHDRAWAL",
    label: "Retrait",
    icon: IconArrowDown,
    palette: dangerPalette,
  },
  {
    value: "TRANSFER_IN",
    label: "Transfert entrant",
    icon: IconTransfer,
    palette: denimPalette,
  },
  {
    value: "TRANSFER_OUT",
    label: "Transfert sortant",
    icon: IconTransfer,
    palette: clayPalette,
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

const formatRpWeekRange = (start: Date | string, end: Date | string) =>
  `${formatRpLongDay(start)} au ${formatRpLongDay(end)}`;

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
  const [importOpened, setImportOpened] = useState(false);
  const [deletePopoverOpened, setDeletePopoverOpened] = useState<string | null>(
    null,
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [pendingOccurrences, setPendingOccurrences] = useState<
    SerializedPlannedOccurrence[]
  >([]);
  const showError = (message: string) =>
    notifications.show({ title: "Erreur", message, color: "danger" });
  const showSuccess = (message: string) =>
    notifications.show({ title: "Succès", message, color: "moss" });

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
        .sort((a, b) => {
          const dateCmp = +new Date(a.date) - +new Date(b.date);
          if (dateCmp !== 0) return (sortOrder === "asc" ? 1 : -1) * dateCmp;
          return a.order - b.order;
        }),
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
      amount: parseAmount(newTransaction.amount) ?? 0,
      order: newTransaction.order ?? 0,
      orderId: null,
      createdAt: "",
      updatedAt: "",
      isNew: true,
    };
    return sortOrder === "desc" ? [draft, ...data] : [...data, draft];
  }, [filteredTransactions, newTransaction, sortOrder, week.id]);

  const handleAddNameSuggestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const result = await actions.addNameSuggestion({ value: trimmed });
    if (!isSuccess(result)) {
      showError(result.error);
      return;
    }
    setNameSuggestions((values) =>
      values.some((item) => item.toLowerCase() === result.data.toLowerCase())
        ? values
        : [...values, result.data],
    );
    showSuccess("Suggestion ajoutée");
  };

  const handleDeleteNameSuggestion = async (
    value: string,
    e?: React.MouseEvent,
  ) => {
    e?.preventDefault();
    e?.stopPropagation();
    const trimmed = value.trim();
    if (!trimmed) return;
    const result = await actions.deleteNameSuggestion({ value: trimmed });
    if (!isSuccess(result)) {
      showError(result.error);
      return;
    }
    setNameSuggestions((values) =>
      values.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
    );
    showSuccess("Suggestion supprimée");
  };

  const handleAddDescriptionSuggestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const result = await actions.addDescriptionSuggestion({ value: trimmed });
    if (!isSuccess(result)) {
      showError(result.error);
      return;
    }
    setDescriptionSuggestions((values) =>
      values.some((item) => item.toLowerCase() === result.data.toLowerCase())
        ? values
        : [...values, result.data],
    );
    showSuccess("Suggestion ajoutée");
  };

  const handleDeleteDescriptionSuggestion = async (
    value: string,
    e?: React.MouseEvent,
  ) => {
    e?.preventDefault();
    e?.stopPropagation();
    const trimmed = value.trim();
    if (!trimmed) return;
    const result = await actions.deleteDescriptionSuggestion({ value: trimmed });
    if (!isSuccess(result)) {
      showError(result.error);
      return;
    }
    setDescriptionSuggestions((values) =>
      values.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
    );
    showSuccess("Suggestion supprimée");
  };

  const saveTransaction = async (transaction: TransactionDraft) => {
    const amount = parseAmount(transaction.amount);
    if (
      !transaction.id &&
      (!transaction.date ||
        !transaction.type ||
        !transaction.name ||
        amount == null ||
        amount <= 0)
    )
      return showError("Veuillez remplir tous les champs requis");
    if (amount != null && amount <= 0)
      return showError("Le montant doit être positif");
    setLoading(true);
    try {
      const result = transaction.id
        ? await actions.updateTransaction({
            ...transaction,
            id: transaction.id,
            amount,
          })
        : await actions.createTransaction({
            weekId: week.id,
            date: transaction.date!,
            type: transaction.type!,
            name: transaction.name!,
            description: transaction.description,
            amount: amount!,
            order: transaction.order,
          });
      if (!isSuccess(result)) return showError(result.error);
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
    const target = sameDay[direction === "up" ? index - 1 : index + 1];
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

  const canSaveNewTransaction =
    Boolean(newTransaction?.name?.trim()) &&
    parseAmount(newTransaction?.amount) != null;

  const trySubmitNewTransaction = () => {
    if (!newTransaction || !canSaveNewTransaction) return;
    void saveTransaction(newTransaction);
  };

  const handleNewTransactionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (!canSaveNewTransaction) return;
    e.preventDefault();
    queueMicrotask(() => trySubmitNewTransaction());
  };

  return (
    <Container size={1600} py="xl">
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
                  <Badge size="xs" color="amber" circle>
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
                  <Group justify="space-between" wrap="wrap" align="center">
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
                      <RpDateInput
                        value={weekDateValue}
                        onChange={(date) => date && void loadWeek(date)}
                        w={160}
                      />
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
                    <div style={{ textAlign: "right" }}>
                      <Text size="xs" c="dimmed" mb={2}>
                        Période
                      </Text>
                      <Text size="sm" fw={600}>
                        {formatRpWeekRange(week.weekStart, week.weekEnd)}
                      </Text>
                    </div>
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
                        c={weekFlow.in - weekFlow.out >= 0 ? "moss" : "danger"}
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
                <Group>
                  {!newTransaction && (
                    <>
                      <Button
                        leftSection={<IconFileImport size={18} />}
                        size="sm"
                        variant="light"
                        onClick={() => setImportOpened(true)}
                      >
                        Importer
                      </Button>
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
                    </>
                  )}
                </Group>
              </Group>
              <Paper shadow="sm" withBorder p={0}>
                <DataTable
                  records={records}
                  fetching={loading}
                  striped
                  highlightOnHover
                  minHeight={records.length === 0 ? 200 : undefined}
                  emptyState={
                    <DataTableEmptyState
                      icon={IconReceipt}
                      message={
                        typeFilter.length
                          ? "Aucune transaction ne correspond aux filtres."
                          : "Aucune transaction sur cette semaine."
                      }
                    />
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
                      width: 110,
                      noWrap: true,
                      render: (transaction) =>
                        editable(transaction) ? (
                          <RpDateInput
                            size="xs"
                            value={
                              draftFor(transaction)?.date ?? transaction.date
                            }
                            onChange={(date) =>
                              date && setDraft(transaction, { date })
                            }
                            onKeyDown={
                              transaction.isNew
                                ? handleNewTransactionKeyDown
                                : undefined
                            }
                          />
                        ) : (
                          <Text size="sm">
                            {formatRpDay(transaction.date)}
                          </Text>
                        ),
                    },
                    {
                      accessor: "type",
                      title: "Type",
                      width: 210,
                      noWrap: true,
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
                            onKeyDown={
                              transaction.isNew
                                ? handleNewTransactionKeyDown
                                : undefined
                            }
                          />
                        ) : (
                          (() => {
                            const info = typeInfo(transaction.type);
                            const Icon = info.icon;
                            return (
                              <Badge
                                leftSection={<Icon size={14} />}
                                variant="outline"
                                radius="sm"
                                style={apothecaryPillStyle(info.palette)}
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
                          <SuggestionAutocomplete
                            size="xs"
                            suggestions={nameSuggestions}
                            extraOptions={companyNames}
                            value={
                              draftFor(transaction)?.name ?? transaction.name
                            }
                            onChange={(name) => setDraft(transaction, { name })}
                            onAddSuggestion={handleAddNameSuggestion}
                            onDeleteSuggestion={handleDeleteNameSuggestion}
                            onKeyDown={
                              transaction.isNew
                                ? handleNewTransactionKeyDown
                                : undefined
                            }
                          />
                        ) : (
                          <Text size="sm" lineClamp={1} title={transaction.name}>
                            {transaction.name}
                          </Text>
                        ),
                    },
                    {
                      accessor: "description",
                      title: "Description",
                      render: (transaction) =>
                        editable(transaction) ? (
                          <SuggestionAutocomplete
                            size="xs"
                            suggestions={descriptionSuggestions}
                            value={
                              draftFor(transaction)?.description ??
                              transaction.description ??
                              ""
                            }
                            onChange={(description) =>
                              setDraft(transaction, { description })
                            }
                            onAddSuggestion={handleAddDescriptionSuggestion}
                            onDeleteSuggestion={
                              handleDeleteDescriptionSuggestion
                            }
                            onKeyDown={
                              transaction.isNew
                                ? handleNewTransactionKeyDown
                                : undefined
                            }
                          />
                        ) : (
                          <Text
                            size="sm"
                            lineClamp={1}
                            title={transaction.description || undefined}
                          >
                            {transaction.description || "-"}
                          </Text>
                        ),
                    },
                    {
                      accessor: "amount",
                      title: "Montant",
                      textAlign: "right",
                      width: 110,
                      noWrap: true,
                      render: (transaction) =>
                        editable(transaction) ? (
                          <NumberInput
                            size="xs"
                            w={100}
                            min={0}
                            decimalScale={2}
                            allowDecimal
                            value={
                              draftFor(transaction)?.amount ??
                              (transaction.isNew ? "" : transaction.amount)
                            }
                            onChange={(amount) =>
                              setDraft(transaction, { amount })
                            }
                            onKeyDown={
                              transaction.isNew
                                ? handleNewTransactionKeyDown
                                : undefined
                            }
                          />
                        ) : (
                          <Text
                            size="sm"
                            fw={600}
                            c={isIncome(transaction.type) ? "moss" : "danger"}
                            style={{ whiteSpace: "nowrap" }}
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
                      width: 180,
                      noWrap: true,
                      render: (transaction) => {
                        if (transaction.isNew)
                          return (
                            <Group gap={4} justify="center" wrap="nowrap">
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="moss"
                                onClick={() => trySubmitNewTransaction()}
                                disabled={!canSaveNewTransaction}
                              >
                                <IconCheck size={16} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="slate"
                                onClick={() => setNewTransaction(null)}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Group>
                          );
                        if (editingTransaction === transaction.id)
                          return (
                            <Group gap={4} justify="center" wrap="nowrap">
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="moss"
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
                                size="sm"
                                variant="light"
                                color="slate"
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
                        const canUp = index > 0;
                        const canDown = index < sameDay.length - 1;
                        return (
                          <Group gap={4} justify="center" wrap="nowrap">
                            {sameDay.length > 1 && (
                              <>
                                <ActionIcon
                                  size="sm"
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
                                  size="sm"
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
                              size="sm"
                              variant="light"
                              color="slate"
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
                                  size="sm"
                                  variant="light"
                                  color="danger"
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
                                      color="slate"
                                      onClick={() =>
                                        setDeletePopoverOpened(null)
                                      }
                                    >
                                      Annuler
                                    </Button>
                                    <Button
                                      size="xs"
                                      color="danger"
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
      <ImportTransactionsModal
        opened={importOpened}
        onClose={() => setImportOpened(false)}
        onImported={async () => {
          await Promise.all([loadWeek(new Date(week.weekStart)), loadWeeks()]);
        }}
      />
    </Container>
  );
}
