'use client';

import { useState } from 'react';
import { Button, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { deleteCabinet } from '@/app/_actions/cabinet/cabinets';
import { handleAction } from '@/lib/action';

interface DeleteCabinetModalProps {
  opened: boolean;
  onClose: () => void;
  dispensarySlug: string;
  cabinetId: string | null;
  cabinetName: string;
  onSuccess: () => void;
}

export function DeleteCabinetModal({
  opened,
  onClose,
  dispensarySlug,
  cabinetId,
  cabinetName,
  onSuccess,
}: DeleteCabinetModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!cabinetId) return;
    setSubmitting(true);
    try {
      const result = await deleteCabinet(dispensarySlug, cabinetId);
      handleAction(result);
      notifications.show({
        title: 'Succès',
        message: 'Cabinet supprimé',
        color: 'moss',
      });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Suppression impossible',
        color: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Supprimer le cabinet"
      icon={IconTrash}
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button color="danger" loading={submitting} onClick={() => void handleDelete()}>
            Supprimer
          </Button>
        </AppModalFooter>
      }
    >
      <Text>
        Confirmer la suppression du cabinet <strong>{cabinetName}</strong> ?
        Tous les patients et dossiers associés seront supprimés.
      </Text>
    </AppModal>
  );
}
