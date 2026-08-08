"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useBankUi } from "../BankUiProvider";
import type {
  BankActionResult,
  SerializedPlannedTransaction,
  TransactionType,
} from "../types";

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Lundi" },
  { value: "2", label: "Mardi" },
  { value: "3", label: "Mercredi" },
  { value: "4", label: "Jeudi" },
  { value: "5", label: "Vendredi" },
  { value: "6", label: "Samedi" },
  { value: "7", label: "Dimanche" },
];
const TYPE_OPTIONS = [
  { value: "DEPOSIT", label: "Dépôt" },
  { value: "WITHDRAWAL", label: "Retrait" },
  { value: "TRANSFER_IN", label: "Transfert entrant" },
  { value: "TRANSFER_OUT", label: "Transfert sortant" },
];
const TYPE_LABELS = Object.fromEntries(
  TYPE_OPTIONS.map((option) => [option.value, option.label]),
);
function isSuccess<T>(
  result: BankActionResult<T>,
): result is { status: number; data: T } {
  return result.data !== undefined;
}

type BankPlannedPanelProps = { onChanged?: () => void };

export function BankPlannedPanel({ onChanged }: BankPlannedPanelProps) {
  const { actions } = useBankUi();
  const [planned, setPlanned] = useState<SerializedPlannedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpened, setFormOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<
    string[]
  >([]);
  const [formType, setFormType] = useState<TransactionType>("DEPOSIT");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState<number | undefined>();
  const [formScheduleKind, setFormScheduleKind] = useState<"ONCE" | "WEEKLY">(
    "WEEKLY",
  );
  const [formOnceDate, setFormOnceDate] = useState<Date | null>(null);
  const [formWeekdays, setFormWeekdays] = useState<string[]>([]);
  const isEditing = editingId !== null;

  const error = (message: string) =>
    notifications.show({ title: "Erreur", message, color: "red" });
  const success = (message: string) =>
    notifications.show({ title: "Succès", message, color: "green" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await actions.getPlannedTransactions();
      if (isSuccess(result)) setPlanned(result.data);
      else error(result.error);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  const loadSuggestions = useCallback(async () => {
    const [names, descriptions] = await Promise.all([
      actions.getNameSuggestions(),
      actions.getDescriptionSuggestions(),
    ]);
    if (isSuccess(names))
      setNameSuggestions([
        ...names.data.suggestions,
        ...(names.data.companyNames ?? []),
      ]);
    if (isSuccess(descriptions)) setDescriptionSuggestions(descriptions.data);
  }, [actions]);

  useEffect(() => {
    void refresh();
    void loadSuggestions();
  }, [refresh, loadSuggestions]);

  const resetForm = () => {
    setFormType("DEPOSIT");
    setFormName("");
    setFormDescription("");
    setFormAmount(undefined);
    setFormScheduleKind("WEEKLY");
    setFormOnceDate(null);
    setFormWeekdays([]);
    setEditingId(null);
  };
  const closeForm = () => {
    setFormOpened(false);
    resetForm();
  };
  const afterMutation = async () => {
    await refresh();
    onChanged?.();
  };

  const openEdit = (item: SerializedPlannedTransaction) => {
    setEditingId(item.id);
    setFormType(item.type);
    setFormName(item.name);
    setFormDescription(item.description ?? "");
    setFormAmount(item.amount);
    setFormScheduleKind(item.scheduleKind);
    setFormOnceDate(item.onceDate ? new Date(item.onceDate) : null);
    setFormWeekdays(item.weekdays.map(String));
    setFormOpened(true);
  };

  const saveFreeTextSuggestions = async () => {
    if (
      formName.trim() &&
      !nameSuggestions.some(
        (value) => value.toLowerCase() === formName.trim().toLowerCase(),
      )
    ) {
      const result = await actions.addNameSuggestion({
        value: formName.trim(),
      });
      if (isSuccess(result))
        setNameSuggestions((values) => [...values, result.data]);
    }
    if (
      formDescription.trim() &&
      !descriptionSuggestions.some(
        (value) => value.toLowerCase() === formDescription.trim().toLowerCase(),
      )
    ) {
      const result = await actions.addDescriptionSuggestion({
        value: formDescription.trim(),
      });
      if (isSuccess(result))
        setDescriptionSuggestions((values) => [...values, result.data]);
    }
  };

  const submit = async () => {
    if (!formName.trim() || !formAmount || formAmount <= 0)
      return error("Veuillez remplir les champs requis");
    if (formScheduleKind === "ONCE" && !formOnceDate)
      return error("La date est requise pour une transaction unique");
    if (formScheduleKind === "WEEKLY" && formWeekdays.length === 0)
      return error("Sélectionnez au moins un jour");
    const input = {
      type: formType,
      name: formName.trim(),
      description: formDescription.trim() || null,
      amount: formAmount,
      scheduleKind: formScheduleKind,
      onceDate: formScheduleKind === "ONCE" ? formOnceDate : null,
      weekdays:
        formScheduleKind === "WEEKLY" ? formWeekdays.map(Number) : undefined,
    };
    setLoading(true);
    try {
      const result = editingId
        ? await actions.updatePlannedTransaction({ id: editingId, ...input })
        : await actions.createPlannedTransaction(input);
      if (!isSuccess(result)) return error(result.error);
      await saveFreeTextSuggestions();
      success(
        editingId ? "Planification mise à jour" : "Transaction planifiée créée",
      );
      closeForm();
      await afterMutation();
    } finally {
      setLoading(false);
    }
  };

  const updateActive = async (item: SerializedPlannedTransaction) => {
    setLoading(true);
    try {
      const result = await actions.updatePlannedTransaction({
        id: item.id,
        isActive: !item.isActive,
      });
      if (!isSuccess(result)) return error(result.error);
      success(
        item.isActive ? "Planification désactivée" : "Planification activée",
      );
      await afterMutation();
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    setLoading(true);
    try {
      const result = await actions.deletePlannedTransaction({ id: deleteId });
      if (!isSuccess(result)) return error(result.error);
      success("Planification supprimée");
      setDeleteId(null);
      await afterMutation();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg">
      <Paper shadow="sm" p="md" withBorder radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Planifications</Text>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                resetForm();
                setFormOpened(true);
              }}
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
                <Paper
                  key={item.id}
                  p="sm"
                  withBorder
                  radius="sm"
                  opacity={item.isActive ? 1 : 0.65}
                >
                  <Group justify="space-between" wrap="wrap" gap="sm">
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Text fw={600} size="sm">
                          {item.name}
                        </Text>
                        <Badge size="xs" variant="outline">
                          {TYPE_LABELS[item.type]}
                        </Badge>
                        <Badge
                          size="xs"
                          variant="outline"
                          color={item.isActive ? "green" : "gray"}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {item.amount.toFixed(2)} $ ·{" "}
                        {item.scheduleKind === "ONCE"
                          ? `Une fois le ${item.onceDate ? dayjs(item.onceDate).format("DD/MM/YYYY") : ""}`
                          : `Hebdo · ${item.weekdays.map((day) => WEEKDAY_OPTIONS.find((option) => option.value === String(day))?.label).join(", ")}`}
                        {item.description ? ` · ${item.description}` : ""}
                      </Text>
                    </Stack>
                    <Group gap="sm">
                      <Switch
                        size="sm"
                        checked={item.isActive}
                        onChange={() => void updateActive(item)}
                        disabled={loading}
                        label="Active"
                      />
                      <ActionIcon
                        variant="light"
                        onClick={() => openEdit(item)}
                        disabled={loading}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
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
      <Modal
        opened={formOpened}
        onClose={closeForm}
        title={
          isEditing ? "Modifier la planification" : "Nouvelle planification"
        }
        size="md"
      >
        <Stack>
          <Select
            label="Type"
            data={TYPE_OPTIONS}
            value={formType}
            onChange={(value) => value && setFormType(value as TransactionType)}
            required
          />
          <Autocomplete
            label="Nom"
            data={nameSuggestions}
            value={formName}
            onChange={setFormName}
            required
          />
          <Autocomplete
            label="Description"
            data={descriptionSuggestions}
            value={formDescription}
            onChange={setFormDescription}
          />
          <NumberInput
            label="Montant"
            value={formAmount}
            onChange={(value) =>
              setFormAmount(typeof value === "number" ? value : undefined)
            }
            min={0}
            decimalScale={2}
            required
          />
          <Select
            label="Fréquence"
            data={[
              { value: "ONCE", label: "Une fois" },
              { value: "WEEKLY", label: "Hebdomadaire" },
            ]}
            value={formScheduleKind}
            onChange={(value) =>
              value && setFormScheduleKind(value as "ONCE" | "WEEKLY")
            }
            required
          />
          {formScheduleKind === "ONCE" ? (
            <DateInput
              label="Date"
              value={formOnceDate?.toISOString().slice(0, 10) ?? null}
              onChange={(value) =>
                setFormOnceDate(value ? new Date(value) : null)
              }
              valueFormat="DD/MM/YYYY"
              locale="fr"
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
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeForm}>
              Annuler
            </Button>
            <Button onClick={() => void submit()} loading={loading}>
              {isEditing ? "Enregistrer" : "Créer"}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Supprimer la planification"
        size="sm"
      >
        <Stack>
          <Text size="sm">
            Êtes-vous sûr de vouloir supprimer cette planification ?
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteId(null)}>
              Annuler
            </Button>
            <Button color="red" loading={loading} onClick={() => void remove()}>
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
