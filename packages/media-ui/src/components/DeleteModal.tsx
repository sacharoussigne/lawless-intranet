'use client';

import { Button, Group, Modal, Stack, Text } from '@mantine/core';

type DeleteModalProps = {
  opened: boolean;
  itemName: string;
  isFolder: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function DeleteModal({ opened, itemName, isFolder, loading, onConfirm, onClose }: DeleteModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Supprimer" centered>
      <Stack gap="md">
        <Text size="sm">
          {isFolder
            ? `Supprimer le dossier « ${itemName} » et tout son contenu (sous-dossiers et fichiers) ?`
            : `Supprimer le fichier « ${itemName} » ?`}{' '}
          Cette action est définitive.
        </Text>
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
