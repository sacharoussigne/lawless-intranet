"use client";

import { useState } from "react";
import { Accordion, Badge, Button, Group, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { SerializedPlannedOccurrence } from "../types";

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Dépôt",
  WITHDRAWAL: "Retrait",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
};

type BankPendingOccurrencesBannerProps = {
  occurrences: SerializedPlannedOccurrence[];
  loading?: boolean;
  onConfirm: (id: string, date: Date) => void;
  onSkip: (id: string) => void;
};

export function BankPendingOccurrencesBanner({
  occurrences,
  loading = false,
  onConfirm,
  onSkip,
}: BankPendingOccurrencesBannerProps) {
  const [editedDates, setEditedDates] = useState<Record<string, Date>>({});
  if (occurrences.length === 0) return null;

  const getDate = (occurrence: SerializedPlannedOccurrence) =>
    editedDates[occurrence.id] ?? new Date(occurrence.date);
  const title =
    occurrences.length === 1
      ? "1 transaction à confirmer"
      : `${occurrences.length} transactions à confirmer`;

  return (
    <Accordion variant="contained" radius="md">
      <Accordion.Item value="pending">
        <Accordion.Control>
          <Group gap="sm">
            <Text size="sm" fw={600}>
              {title}
            </Text>
            <Badge size="sm" variant="outline" color="yellow" circle>
              {occurrences.length}
            </Badge>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            {occurrences.map((occurrence) => {
              const planned = occurrence.plannedTransaction;
              return (
                <Group
                  key={occurrence.id}
                  justify="space-between"
                  wrap="wrap"
                  gap="xs"
                  py={4}
                >
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" fw={600}>
                      {planned.name}
                    </Text>
                    <Badge size="xs" variant="outline">
                      {TYPE_LABELS[planned.type] ?? planned.type}
                    </Badge>
                    <DateInput
                      size="xs"
                      value={getDate(occurrence).toISOString().slice(0, 10)}
                      valueFormat="DD/MM/YYYY"
                      locale="fr"
                      onChange={(date) =>
                        date &&
                        setEditedDates((current) => ({
                          ...current,
                          [occurrence.id]: new Date(date),
                        }))
                      }
                      w={130}
                      aria-label={`Date de ${planned.name}`}
                    />
                    <Text size="xs" c="dimmed">
                      {Number(planned.amount).toFixed(2)} $
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <Button
                      size="compact-xs"
                      color="green"
                      leftSection={<IconCheck size={14} />}
                      onClick={() =>
                        onConfirm(occurrence.id, getDate(occurrence))
                      }
                      loading={loading}
                    >
                      Confirmer
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      leftSection={<IconX size={14} />}
                      onClick={() => onSkip(occurrence.id)}
                      loading={loading}
                    >
                      Ignorer
                    </Button>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
