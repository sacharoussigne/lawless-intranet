'use client';

import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { describeDeletion, type DeleteModalItem } from '../format';

type DeleteModalProps = {
  opened: boolean;
  items: readonly DeleteModalItem[];
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function DeleteModal({ opened, items, loading, onConfirm, onClose }: DeleteModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Supprimer" centered>
      <Stack gap="md">
        <Text size="sm">{describeDeletion(items)} Cette action est définitive.</Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button color="danger" onClick={onConfirm} loading={loading}>
            Supprimer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
