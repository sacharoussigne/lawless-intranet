'use client';

import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { useEffect, useState } from 'react';
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
  grantDocumentAccessAction,
  grantTemplateAccessAction,
  listDocumentAccessesAction,
  listTemplateAccessesAction,
  listUsersForDocumentAccess,
  revokeDocumentAccessAction,
  revokeTemplateAccessAction,
} from '@/app/_actions/documentAccesses';

type AccessUser = {
  id: string;
  name: string;
};

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
  const [allUsers, setAllUsers] = useState<AccessUser[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [accessType, setAccessType] = useState<'READ' | 'WRITE'>('READ');
  const [loading, setLoading] = useState(false);

  const reloadAccesses = async () => {
    if (!resourceId) return;

    const result =
      resourceType === 'template'
        ? await listTemplateAccessesAction(dispensarySlug, { templateId: resourceId })
        : await listDocumentAccessesAction(dispensarySlug, { documentId: resourceId });

    const data = handleAction(result);
    if (data) {
      setAccesses(data);
    }
  };

  const loadUsers = async (currentAccesses: DocumentAccessItem[]) => {
    const result = await listUsersForDocumentAccess();
    const data = handleAction(result);
    if (!data) return;

    const dispensaryUsers = (data.users || []) as AccessUser[];
    setAllUsers(dispensaryUsers);
    setUsers(
      dispensaryUsers.filter(
        (user) =>
          user.id !== ownerId &&
          !currentAccesses.some((access) => access.userId === user.id),
      ),
    );
  };

  useEffect(() => {
    if (opened && resourceId) {
      void (async () => {
        await reloadAccesses();
      })();
    }
  }, [opened, resourceId, resourceType, dispensarySlug]);

  useEffect(() => {
    if (opened) {
      void loadUsers(accesses);
    }
  }, [opened, accesses, ownerId]);

  const handleAddAccess = async () => {
    if (!resourceId || !selectedUserId) return;

    try {
      setLoading(true);
      const result =
        resourceType === 'template'
          ? await grantTemplateAccessAction(dispensarySlug, {
              templateId: resourceId,
              userId: selectedUserId,
              accessType,
            })
          : await grantDocumentAccessAction(dispensarySlug, {
              documentId: resourceId,
              userId: selectedUserId,
              accessType,
            });

      handleAction(result);
      notifications.show({
        title: 'Succès',
        message: 'Accès ajouté avec succès',
        color: 'green',
      });
      setSelectedUserId(null);
      setAccessType('READ');
      await reloadAccesses();
      onSuccess?.();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de l\'ajout de l\'accès',
        color: 'red',
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
        color: 'green',
      });
      await reloadAccesses();
      onSuccess?.();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message:
          error instanceof Error ? error.message : 'Erreur lors de la suppression de l\'accès',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Partager : ${resourceName}`}
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Accordez un accès en lecture ou en écriture à un autre joueur.
        </Text>

        <Group align="flex-end" grow>
          <Select
            label="Joueur"
            placeholder="Sélectionner un joueur"
            data={users.map((user) => ({ value: user.id, label: user.name }))}
            value={selectedUserId}
            onChange={setSelectedUserId}
            searchable
            nothingFoundMessage="Aucun joueur disponible"
          />
          <Select
            label="Type d'accès"
            data={[
              { value: 'READ', label: 'Lecture' },
              { value: 'WRITE', label: 'Écriture' },
            ]}
            value={accessType}
            onChange={(value) => setAccessType((value as 'READ' | 'WRITE') ?? 'READ')}
          />
          <Button onClick={handleAddAccess} disabled={!selectedUserId} loading={loading}>
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
              accesses.map((access) => {
                const user = allUsers.find((item) => item.id === access.userId);
                return (
                  <Table.Tr key={access.id}>
                    <Table.Td>{user?.name ?? access.userId}</Table.Td>
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
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Modal>
  );
}
