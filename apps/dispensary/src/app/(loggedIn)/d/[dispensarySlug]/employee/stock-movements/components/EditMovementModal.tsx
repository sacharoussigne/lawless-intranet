'use client';

import { useEffect, useState } from 'react';
import { Button, NumberInput, Select, Textarea } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import type { StockMovementListItem } from '@/types/stock';
import { STOCK_MOVEMENT_KIND_OPTIONS } from '@/lib/stock/movements';
import type { StockMovementKind } from '@prisma/client';
import { useUpdateStockMovementMutation } from '../hooks/useStockMovementsQueries';

interface EditMovementModalProps {
  opened: boolean;
  onClose: () => void;
  movement: StockMovementListItem | null;
}

export function EditMovementModal({ opened, onClose, movement }: EditMovementModalProps) {
  const updateMutation = useUpdateStockMovementMutation();
  const [quantity, setQuantity] = useState<number | string>(0);
  const [kind, setKind] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (movement) {
      setQuantity(movement.quantity);
      setKind(movement.kind);
      setNote(movement.note ?? '');
    }
  }, [movement]);

  const handleSave = async () => {
    if (!movement || kind === null) return;

    try {
      await updateMutation.mutateAsync({
        id: movement.id,
        quantity: Number(quantity),
        kind: kind as StockMovementKind,
        note: note.trim() || null,
      });
      onClose();
    } catch {
      // Notification handled by mutation hook
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Modifier le mouvement"
      description="Cette correction n'affecte que l'audit. Le stock actuel reste inchangé."
      icon={IconEdit}
      size="md"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button color="sage" onClick={handleSave} loading={updateMutation.isPending}>
            Enregistrer
          </Button>
        </AppModalFooter>
      }
    >
      <NumberInput
        label="Delta"
        value={quantity}
        onChange={setQuantity}
        allowDecimal={false}
      />
      <Select
        label="Type"
        data={STOCK_MOVEMENT_KIND_OPTIONS}
        value={kind}
        onChange={setKind}
      />
      <Textarea
        label="Note"
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        maxLength={500}
        autosize
        minRows={2}
      />
    </AppModal>
  );
}
