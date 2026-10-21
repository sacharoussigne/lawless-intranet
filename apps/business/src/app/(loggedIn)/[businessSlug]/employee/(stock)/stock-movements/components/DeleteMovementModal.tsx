'use client';

import { Button, List, Text } from '@mantine/core';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import type { StockMovementListItem } from '@/types/stock';
import { useDeleteStockMovementsMutation } from '../hooks/useStockMovementsQueries';

interface DeleteMovementModalProps {
  opened: boolean;
  onClose: () => void;
  movements: StockMovementListItem[];
  onDeleted?: () => void;
}

export function DeleteMovementModal({
  opened,
  onClose,
  movements,
  onDeleted,
}: DeleteMovementModalProps) {
  const deleteMutation = useDeleteStockMovementsMutation();
  const isBulk = movements.length > 1;

  const handleDelete = async () => {
    if (movements.length === 0) return;

    try {
      await deleteMutation.mutateAsync({ ids: movements.map((movement) => movement.id) });
      onDeleted?.();
      onClose();
    } catch {
      // Notification handled by mutation hook
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={isBulk ? 'Supprimer les mouvements' : 'Supprimer le mouvement'}
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
      {isBulk ? (
        <>
          <Text>
            Supprimer <strong>{movements.length} mouvements</strong> sélectionnés ?
          </Text>
          <List size="sm" mt="sm" spacing="xs">
            {movements.slice(0, 5).map((movement) => (
              <List.Item key={movement.id}>
                {movement.itemName} —{' '}
                {new Date(movement.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </List.Item>
            ))}
            {movements.length > 5 && (
              <List.Item c="dimmed">… et {movements.length - 5} autre(s)</List.Item>
            )}
          </List>
        </>
      ) : (
        <Text>
          Supprimer ce mouvement pour <strong>{movements[0]?.itemName}</strong> ?
        </Text>
      )}
      <Text size="sm" c="dimmed" mt="sm">
        Cette action retire uniquement {isBulk ? 'ces entrées' : "l'entrée"} d&apos;audit. Le stock
        actuel ne sera pas modifié.
      </Text>
    </AppModal>
  );
}
