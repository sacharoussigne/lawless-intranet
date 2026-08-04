'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';

type DispensaryToDelete = {
  id: string;
  name: string;
  displayName: string;
  membersCount: number;
};

interface DeleteDispensaryModalProps {
  opened: boolean;
  onClose: () => void;
  dispensary: DispensaryToDelete | null;
  loading: boolean;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteDispensaryModal({
  opened,
  onClose,
  dispensary,
  loading,
  onConfirm,
}: DeleteDispensaryModalProps) {
  const [confirmationName, setConfirmationName] = useState('');

  useEffect(() => {
    if (!opened) {
      setConfirmationName('');
    }
  }, [opened]);

  const expectedName = dispensary?.displayName ?? '';
  const canDelete =
    Boolean(dispensary) &&
    confirmationName.trim() === expectedName &&
    expectedName.length > 0;

  const handleDelete = async () => {
    if (!dispensary || !canDelete) return;
    await onConfirm(dispensary.id);
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Supprimer le dispensaire"
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
          Toutes les données de ce dispensaire seront définitivement effacées :
          membres, stock, ventes, commandes, banque, cabinets, agendas et documents.
        </Alert>
        <Text>
          Vous êtes sur le point de supprimer{' '}
          <strong>{dispensary?.displayName}</strong>
          {dispensary && dispensary.membersCount > 0
            ? ` (${dispensary.membersCount} membre(s))`
            : ''}
          .
        </Text>
        <TextInput
          label="Confirmation"
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
