'use client';

import { Button, Text } from '@mantine/core';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import type { StockMovementListItem } from '@/types/stock';
import { useDeleteStockMovementMutation } from '../hooks/useStockMovementsQueries';

interface DeleteMovementModalProps {
  opened: boolean;
  onClose: () => void;
  movement: StockMovementListItem | null;
}

export function DeleteMovementModal({ opened, onClose, movement }: DeleteMovementModalProps) {
  const deleteMutation = useDeleteStockMovementMutation();

  const handleDelete = async () => {
    if (!movement) return;

    try {
      await deleteMutation.mutateAsync({ id: movement.id });
      onClose();
    } catch {
      // Notification handled by mutation hook
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Supprimer le mouvement"
      size="md"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button
            color="danger"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Supprimer
          </Button>
        </AppModalFooter>
      }
    >
      <Text>
        Supprimer ce mouvement pour <strong>{movement?.itemName}</strong> ?
      </Text>
      <Text size="sm" c="dimmed" mt="sm">
        Cette action retire uniquement l&apos;entrée d&apos;audit. Le stock actuel ne sera pas
        modifié.
      </Text>
    </AppModal>
  );
}
