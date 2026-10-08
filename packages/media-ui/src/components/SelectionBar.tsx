'use client';

import { ActionIcon, Button, Group, Paper, Text, Tooltip } from '@mantine/core';
import { IconArrowsMove, IconTrash, IconX } from '@tabler/icons-react';

type SelectionBarProps = {
  count: number;
  onClear: () => void;
  onMove: () => void;
  onDelete: () => void;
};

/** Drive-like bar shown while items are selected. */
export function SelectionBar({ count, onClear, onMove, onDelete }: SelectionBarProps) {
  return (
    <Paper radius="xl" px="xs" py={4} bg="var(--mantine-color-default-hover)" withBorder={false}>
      <Group gap="xs" wrap="nowrap">
        <Tooltip label="Tout désélectionner (Échap)">
          <ActionIcon variant="subtle" color="slate" radius="xl" aria-label="Tout désélectionner" onClick={onClear}>
            <IconX size={18} />
          </ActionIcon>
        </Tooltip>
        <Text size="sm" fw={500} miw={110}>
          {count > 1 ? `${count} sélectionnés` : '1 sélectionné'}
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
