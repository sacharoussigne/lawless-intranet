'use client';

import { ActionIcon, Button, Group, Paper, Text, Tooltip } from '@mantine/core';
import { IconArrowsMove, IconTrash, IconX } from '@tabler/icons-react';

type SelectionBarProps = {
  count: number;
  onClear: () => void;
  onMove: () => void;
  onDelete: () => void;
  /** Phones: full-width bar at the bottom, large icon buttons. */
  compact?: boolean;
};

/** Drive-like bar shown while items are selected. */
export function SelectionBar({ count, onClear, onMove, onDelete, compact = false }: SelectionBarProps) {
  const label = count > 1 ? `${count} sélectionnés` : count === 1 ? '1 sélectionné' : 'Touchez pour sélectionner';

  if (compact) {
    return (
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <ActionIcon variant="subtle" color="slate" radius="xl" size="xl" aria-label="Quitter la sélection" onClick={onClear}>
          <IconX size={20} />
        </ActionIcon>
        <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }} truncate="end">
          {label}
        </Text>
        <ActionIcon variant="light" radius="xl" size="xl" aria-label="Déplacer" disabled={count === 0} onClick={onMove}>
          <IconArrowsMove size={20} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          color="danger"
          radius="xl"
          size="xl"
          aria-label="Supprimer"
          disabled={count === 0}
          onClick={onDelete}
        >
          <IconTrash size={20} />
        </ActionIcon>
      </Group>
    );
  }

  return (
    <Paper radius="xl" px="xs" py={4} bg="var(--mantine-color-default-hover)" withBorder={false}>
      <Group gap="xs" wrap="nowrap">
        <Tooltip label="Tout désélectionner (Échap)">
          <ActionIcon variant="subtle" color="slate" radius="xl" aria-label="Tout désélectionner" onClick={onClear}>
            <IconX size={18} />
          </ActionIcon>
        </Tooltip>
        <Text size="sm" fw={500} miw={110}>
          {label}
        </Text>
        <Button variant="subtle" size="compact-sm" leftSection={<IconArrowsMove size={16} />} onClick={onMove}>
          Déplacer
        </Button>
        <Button
          variant="subtle"
          color="danger"
          size="compact-sm"
          leftSection={<IconTrash size={16} />}
          onClick={onDelete}
        >
          Supprimer
        </Button>
      </Group>
    </Paper>
  );
}
