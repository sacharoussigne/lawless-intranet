'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';

type BusinessToDelete = {
  id: string;
  name: string;
  displayName: string;
  membersCount: number;
};

interface DeleteBusinessModalProps {
  opened: boolean;
  onClose: () => void;
  business: BusinessToDelete | null;
  loading: boolean;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteBusinessModal({
  opened,
  onClose,
  business,
  loading,
  onConfirm,
}: DeleteBusinessModalProps) {
  const [confirmationName, setConfirmationName] = useState('');

  useEffect(() => {
    if (!opened) {
      setConfirmationName('');
    }
  }, [opened]);

  const expectedName = business?.displayName ?? '';
  const canDelete =
    Boolean(business) &&
    confirmationName.trim() === expectedName &&
    expectedName.length > 0;

  const handleDelete = async () => {
    if (!business || !canDelete) return;
    await onConfirm(business.id);
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Supprimer l’entreprise"
      size="md"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            color="danger"
            onClick={handleDelete}
            loading={loading}
            disabled={!canDelete}
          >
            Supprimer définitivement
          </Button>
        </AppModalFooter>
      }
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Action irréversible"
          color="danger"
        >
          Toutes les données de cette entreprise seront définitivement effacées :
          membres, stock, ventes, commandes, banque, cabinets, agendas et documents.
        </Alert>
        <Text>
          Vous êtes sur le point de supprimer{' '}
          <strong>{business?.displayName}</strong>
          {business && business.membersCount > 0
            ? ` (${business.membersCount} membre(s))`
            : ''}
          .
        </Text>
        <TextInput
          label="Confirmation"
          data-autofocus
          description={`Saisissez « ${expectedName} » pour confirmer`}
          placeholder={expectedName}
          value={confirmationName}
          onChange={(e) => setConfirmationName(e.currentTarget.value)}
          disabled={loading}
        />
      </Stack>
    </AppModal>
  );
}
