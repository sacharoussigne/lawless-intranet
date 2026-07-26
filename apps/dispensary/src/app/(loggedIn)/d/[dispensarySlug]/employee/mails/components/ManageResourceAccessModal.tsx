'use client';

import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Select,
  Button,
  Group,
  Text,
  Badge,
  ActionIcon,
  Table,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { handleAction } from '@/lib/action';
import type { DocumentAccessItem } from '@/types/mails';
import {
  UserPseudoSearch,
  type UserPseudoSearchResult,
} from '@/app/_components/UserPseudoSearch/UserPseudoSearch';
import {
  grantDocumentAccessAction,
  grantTemplateAccessAction,
  listDocumentAccessesAction,
  listTemplateAccessesAction,
  revokeDocumentAccessAction,
  revokeTemplateAccessAction,
  searchUsersForDocumentAccess,
} from '@/app/_actions/documentAccesses';

type ManageResourceAccessModalProps = {
  opened: boolean;
  onClose: () => void;
  resourceType: 'template' | 'document';
  resourceId: string | null;
  resourceName: string;
  ownerId?: string | null;
  onSuccess?: () => void;
};

export function ManageResourceAccessModal({
  opened,
  onClose,
  resourceType,
  resourceId,
  resourceName,
  ownerId,
  onSuccess,
}: ManageResourceAccessModalProps) {
  const dispensarySlug = useRequiredDispensarySlug();
  const [accesses, setAccesses] = useState<DocumentAccessItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserPseudoSearchResult | null>(null);
  const [accessType, setAccessType] = useState<'READ' | 'WRITE'>('READ');
  const [loading, setLoading] = useState(false);

  const excludeUserIds = [
    ...(ownerId ? [ownerId] : []),
    ...accesses.map((access) => access.userId),
  ];

  const reloadAccesses = useCallback(async () => {
    if (!resourceId) return;

    const result =
      resourceType === 'template'
        ? await listTemplateAccessesAction(dispensarySlug, { templateId: resourceId })
        : await listDocumentAccessesAction(dispensarySlug, { documentId: resourceId });

    const data = handleAction(result);
    if (data) {
      setAccesses(data);
    }
  }, [dispensarySlug, resourceId, resourceType]);

  useEffect(() => {
    if (!opened || !resourceId) return;
    void reloadAccesses();
  }, [opened, resourceId, reloadAccesses]);

  const handleClose = () => {
    setSelectedUser(null);
    setAccessType('READ');
    setAccesses([]);
    onClose();
  };

  const searchUsers = useCallback(
    async (query: string) => {
      const result = await searchUsersForDocumentAccess(dispensarySlug, query);
      if (result.status === 200 && 'data' in result && result.data) {
        return result.data;
      }
      return [];
    },
    [dispensarySlug],
  );

  const handleAddAccess = async () => {
    if (!resourceId || !selectedUser) return;

    try {
      setLoading(true);
      const result =
        resourceType === 'template'
          ? await grantTemplateAccessAction(dispensarySlug, {
              templateId: resourceId,
              userId: selectedUser.id,
              accessType,
            })
          : await grantDocumentAccessAction(dispensarySlug, {
              documentId: resourceId,
              userId: selectedUser.id,
              accessType,
            });

      handleAction(result);
      notifications.show({
        title: 'Succès',
        message: 'Accès ajouté avec succès',
        color: 'moss',
      });
      setSelectedUser(null);
      setAccessType('READ');
      await reloadAccesses();
      onSuccess?.();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de l\'ajout de l\'accès',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccess = async (userId: string) => {
    if (!resourceId) return;

    try {
      setLoading(true);
      const result =
        resourceType === 'template'
          ? await revokeTemplateAccessAction(dispensarySlug, {
              templateId: resourceId,
              userId,
            })
          : await revokeDocumentAccessAction(dispensarySlug, {
              documentId: resourceId,
              userId,
            });

      handleAction(result);
      notifications.show({
        title: 'Succès',
        message: 'Accès supprimé avec succès',
        color: 'moss',
      });
      await reloadAccesses();
      onSuccess?.();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message:
          error instanceof Error ? error.message : 'Erreur lors de la suppression de l\'accès',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Partager : ${resourceName}`}
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Accordez un accès en lecture ou en écriture à un autre joueur.
        </Text>

        <UserPseudoSearch
          inputName="document-access-user-search"
          label="Joueur"
          placeholder="Pseudo…"
          excludeUserIds={excludeUserIds}
          onSearch={searchUsers}
          onSelect={setSelectedUser}
        />
        {selectedUser && (
          <Text size="sm" c="dimmed">
            Joueur sélectionné : {selectedUser.name}
          </Text>
        )}

        <Group align="flex-end" grow>
          <Select
            label="Type d'accès"
            data={[
              { value: 'READ', label: 'Lecture' },
              { value: 'WRITE', label: 'Écriture' },
            ]}
            value={accessType}
            onChange={(value) => setAccessType((value as 'READ' | 'WRITE') ?? 'READ')}
          />
          <Button onClick={handleAddAccess} disabled={!selectedUser} loading={loading}>
            Ajouter
          </Button>
        </Group>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Joueur</Table.Th>
              <Table.Th>Accès</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accesses.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" size="sm">
                    Aucun accès partagé
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              accesses.map((access) => (
                <Table.Tr key={access.id}>
                  <Table.Td>{access.user?.name ?? access.userId}</Table.Td>
                  <Table.Td>
                    <Badge variant="outline" color={access.accessType === 'WRITE' ? 'sage' : 'slate'}>
                      {access.accessType === 'WRITE' ? 'Écriture' : 'Lecture'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="light"
                      color="danger"
                      onClick={() => handleRemoveAccess(access.userId)}
                      loading={loading}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Modal>
  );
}
