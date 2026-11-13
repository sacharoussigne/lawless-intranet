'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { IconTrash, IconUsers } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { UserPseudoSearch } from '@/app/_components/UserPseudoSearch/UserPseudoSearch';
import {
  removeAgendaMember,
  upsertAgendaMember,
} from '@/app/_actions/agenda/members';
import { handleAction } from '@/lib/action';
import {
  AGENDA_ACCESS_LEVELS,
  agendaAccessLevelLabel,
  type AgendaMemberDTO,
} from '@/types/agenda';
import type { AgendaAccessLevel } from '@/types/agenda';
import { fetchRead } from '@/lib/read/fetchRead';
import { useQuery } from '@tanstack/react-query';

interface AgendaMembersModalProps {
  opened: boolean;
  onClose: () => void;
  businessSlug: string;
  agendaId: string | null;
  agendaName: string;
}

export function AgendaMembersModal({
  opened,
  onClose,
  businessSlug,
  agendaId,
  agendaName,
}: AgendaMembersModalProps) {
  const [accessLevel, setAccessLevel] = useState<AgendaAccessLevel>('READ');

  const membersQuery = useQuery({
    queryKey: ['agendaMembers', businessSlug, agendaId],
    queryFn: async () => {
      const data = handleAction(await fetchRead(businessSlug, 'agendaWithMembers', { agendaId: agendaId as string }));
      return (data?.members ?? []) as AgendaMemberDTO[];
    },
    enabled: opened && Boolean(agendaId),
  });
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const loading = membersQuery.isLoading;
  const loadMembers = () => membersQuery.refetch();
  const memberUserIds = useMemo(() => members.map((member) => member.userId), [members]);

  useEffect(() => {
    if (membersQuery.error) {
      notifications.show({
        title: 'Erreur',
        message: membersQuery.error.message || 'Chargement impossible',
        color: 'danger',
      });
    }
  }, [membersQuery.error]);

  const searchAgendaUsers = useCallback(
    async (query: string) => {
      const result = await fetchRead(businessSlug, 'agendaUserSearch', { query });
      const data = handleAction(result);
      return data ?? [];
    },
    [businessSlug],
  );

  const handleAddMember = async (userId: string) => {
    if (!agendaId) return;
    try {
      const result = await upsertAgendaMember(businessSlug, {
        agendaId,
        userId,
        accessLevel,
      });
      handleAction(result);
      await loadMembers();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Ajout impossible',
        color: 'danger',
      });
    }
  };

  const handleUpdateLevel = async (userId: string, level: AgendaAccessLevel) => {
    if (!agendaId) return;
    try {
      const result = await upsertAgendaMember(businessSlug, {
        agendaId,
        userId,
        accessLevel: level,
      });
      handleAction(result);
      await loadMembers();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Mise à jour impossible',
        color: 'danger',
      });
    }
  };

  const handleRemove = async (userId: string) => {
    if (!agendaId) return;
    try {
      const result = await removeAgendaMember(businessSlug, { agendaId, userId });
      handleAction(result);
      await loadMembers();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Suppression impossible',
        color: 'danger',
      });
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={`Membres — ${agendaName}`}
      icon={IconUsers}
      size="lg"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Fermer
          </Button>
        </AppModalFooter>
      }
    >
      <Stack gap="md">
        {/* Top-aligned: the search results grow below the field without moving the select. */}
        <Group align="flex-start" grow>
          <UserPseudoSearch
            enabled={opened}
            inputName="agenda-member-user-search"
            autoFocus
            excludeUserIds={memberUserIds}
            onSearch={searchAgendaUsers}
            onSelect={(user) => void handleAddMember(user.id)}
            actionLabel="Ajouter"
          />
          <Select
            label="Permission"
            data={AGENDA_ACCESS_LEVELS.map((l) => ({
              value: l,
              label: agendaAccessLevelLabel(l),
            }))}
            value={accessLevel}
            onChange={(v) => setAccessLevel((v as AgendaAccessLevel) ?? 'READ')}
          />
        </Group>

        <Stack gap="sm">
          <Text fw={500} size="sm">Membres actuels</Text>
          {loading && <Text size="sm" c="dimmed">Chargement…</Text>}
          {!loading && members.length === 0 && (
            <Text size="sm" c="dimmed">Aucun membre</Text>
          )}
          {members.map((member) => (
            <Group key={member.id} justify="space-between" wrap="nowrap">
              <Text size="sm" style={{ flex: 1 }}>
                {member.user.name}
              </Text>
              <Select
                size="xs"
                w={140}
                data={AGENDA_ACCESS_LEVELS.map((l) => ({
                  value: l,
                  label: agendaAccessLevelLabel(l),
                }))}
                value={member.accessLevel}
                onChange={(v) =>
                  handleUpdateLevel(member.userId, (v as AgendaAccessLevel) ?? member.accessLevel)
                }
              />
              <ActionIcon
                variant="light"
                color="danger"
                onClick={() => handleRemove(member.userId)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      </Stack>
    </AppModal>
  );
}
