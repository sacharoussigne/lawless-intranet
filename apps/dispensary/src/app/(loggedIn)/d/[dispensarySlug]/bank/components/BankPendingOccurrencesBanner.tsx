'use client';

import { useState } from 'react';
import { Accordion, Badge, Button, Group, Stack, Text } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { RpDateInput } from '@/app/_components/RpDatePicker/RpDateInput';
import type { SerializedPlannedOccurrence } from '@/types/bankAccounts';

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  TRANSFER_IN: 'Transfert entrant',
  TRANSFER_OUT: 'Transfert sortant',
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

  const count = occurrences.length;
  const title =
    count === 1 ? '1 transaction à confirmer' : `${count} transactions à confirmer`;

  const getDate = (occurrence: SerializedPlannedOccurrence) =>
    editedDates[occurrence.id] ?? new Date(occurrence.date);

  return (
    <Accordion variant="contained" radius="md" styles={{ item: { borderColor: 'var(--mantine-color-amber-3)' } }}>
      <Accordion.Item value="pending">
        <Accordion.Control>
          <Group gap="sm">
            <Text size="sm" fw={600} style={{ fontFamily: 'var(--disp-font-display)' }}>
              {title}
            </Text>
            <Badge size="sm" variant="outline" color="amber" circle>
              {count}
            </Badge>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            {occurrences.map((occurrence) => {
              const pt = occurrence.plannedTransaction;
              return (
                <Group
                  key={occurrence.id}
                  justify="space-between"
                  wrap="wrap"
                  gap="xs"
                  py={4}
                  align="center"
                >
                  <Group gap="xs" wrap="wrap" style={{ flex: 1, minWidth: 0 }} align="center">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {pt.name}
                    </Text>
                    <Badge size="xs" variant="outline" color="slate">
                      {TYPE_LABELS[pt.type] ?? pt.type}
                    </Badge>
                    <RpDateInput
                      size="xs"
                      value={getDate(occurrence)}
                      onChange={(date) => {
                        if (!date) return;
                        setEditedDates((prev) => ({
                          ...prev,
                          [occurrence.id]: date,
                        }));
                      }}
                      w={130}
                      aria-label={`Date de ${pt.name}`}
                    />
                    <Text size="xs" c="dimmed">
                      {Number(pt.amount).toFixed(2)} $
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <Button
                      size="compact-xs"
                      color="moss"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => onConfirm(occurrence.id, getDate(occurrence))}
                      loading={loading}
                    >
                      Confirmer
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="slate"
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
