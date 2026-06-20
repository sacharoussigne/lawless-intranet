'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { IconStethoscope } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { UserPseudoSearch } from '@/app/_components/UserPseudoSearch/UserPseudoSearch';
import { createCabinet, updateCabinet } from '@/app/_actions/cabinet/cabinets';
import { searchDispensaryUsersForCabinet } from '@/app/_actions/cabinet/members';
import { handleAction } from '@/lib/action';

type CabinetFormData = {
  id?: string;
  name: string;
  description: string | null;
};

interface CabinetFormModalProps {
  opened: boolean;
  onClose: () => void;
  dispensarySlug: string;
  cabinet: CabinetFormData | null;
  onSuccess: () => void;
}

export function CabinetFormModal({
  opened,
  onClose,
  dispensarySlug,
  cabinet,
  onSuccess,
}: CabinetFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCreate = !cabinet?.id;

  const searchCabinetUsers = useCallback(
    async (query: string) => {
      const result = await searchDispensaryUsersForCabinet(
        dispensarySlug,
        query,
        { adminContext: true },
      );
      const data = handleAction(result);
      return data ?? [];
    },
    [dispensarySlug],
  );

  useEffect(() => {
    if (opened) {
      setName(cabinet?.name ?? '');
      setDescription(cabinet?.description ?? '');
      setOwnerQuery('');
      setOwnerUserId(null);
      setOwnerName('');
    }
  }, [opened, cabinet]);

  const handleSubmit = async () => {
    if (isCreate && !ownerUserId) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez sélectionner un propriétaire',
        color: 'danger',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
      };

      let result;
      if (cabinet?.id) {
        result = await updateCabinet(dispensarySlug, { id: cabinet.id, ...payload });
      } else if (ownerUserId) {
        result = await createCabinet(dispensarySlug, {
          ...payload,
          ownerUserId,
        });
      } else {
        return;
      }

      handleAction(result);
      notifications.show({
        title: 'Succès',
        message: cabinet?.id ? 'Cabinet mis à jour' : 'Cabinet créé',
        color: 'moss',
      });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
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
      title={cabinet?.id ? 'Modifier le cabinet' : 'Nouveau cabinet'}
      icon={IconStethoscope}
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button color="sage" loading={submitting} onClick={() => void handleSubmit()}>
            {cabinet?.id ? 'Enregistrer' : 'Créer'}
          </Button>
        </AppModalFooter>
      }
    >
      <TextInput
        label="Nom"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        required
      />
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
        minRows={3}
      />
      {isCreate && (
        <Stack gap="xs">
          <UserPseudoSearch
            label="Propriétaire"
            description="Recherche par pseudo (membre du dispensaire)"
            inputName="cabinet-owner-user-search"
            enabled={opened && isCreate}
            query={ownerQuery}
            onQueryChange={(next) => {
              setOwnerQuery(next);
              if (ownerUserId && next !== ownerName) {
                setOwnerUserId(null);
                setOwnerName('');
              }
            }}
            onSearch={searchCabinetUsers}
            onSelect={(user) => {
              setOwnerUserId(user.id);
              setOwnerName(user.name);
              setOwnerQuery(user.name);
            }}
            hideResults={!!ownerUserId}
            clearQueryOnSelect={false}
          />
          {ownerUserId && (
            <Text size="sm" c="dimmed">
              Propriétaire sélectionné : {ownerName}
            </Text>
          )}
        </Stack>
      )}
    </AppModal>
  );
}
