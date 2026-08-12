'use client';

import { Modal, Stack, Button, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { deleteUser } from '@/app/_actions/users';
import { handleAction } from '@/lib/action';
import type { User } from '@/types/users';

interface DeleteUserModalProps {
  opened: boolean;
  onClose: () => void;
  userToDelete: User | null;
  onSuccess: () => void;
}

export function DeleteUserModal({
  opened,
  onClose,
  userToDelete,
  onSuccess,
}: DeleteUserModalProps) {
  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      const result = await deleteUser({ id: userToDelete.id });
      handleAction(result);
      notifications.show({
        title: 'Succès',
        message: 'Utilisateur supprimé avec succès',
        color: 'terracotta',
      });
      onClose();
      onSuccess();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de la suppression',
        color: 'danger',
      });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Supprimer l'utilisateur">
      <Stack gap="md">
        <Text>
          Êtes-vous sûr de vouloir supprimer l&apos;utilisateur{' '}
          <strong>{userToDelete?.name}</strong> ({userToDelete?.email}) ?
        </Text>
        <Text size="sm" c="danger">
          Cette action est irréversible.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button color="danger" onClick={handleDelete}>
            Supprimer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
