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
  removeCabinetMember,
  searchDispensaryUsersForCabinet,
  upsertCabinetMember,
} from '@/app/_actions/cabinet/members';
import { getCabinetWithMembers } from '@/app/_actions/cabinet/cabinets';
import { handleAction } from '@/lib/action';
import {
  CABINET_ACCESS_LEVELS,
  cabinetAccessLevelLabel,
  type CabinetMemberDTO,
} from '@/types/cabinet';
import type { CabinetAccessLevel } from '@prisma/client';

interface CabinetMembersModalProps {
  opened: boolean;
  onClose: () => void;
  dispensarySlug: string;
  cabinetId: string | null;
  cabinetName: string;
}

export function CabinetMembersModal({
  opened,
  onClose,
  dispensarySlug,
  cabinetId,
  cabinetName,
}: CabinetMembersModalProps) {
  const [members, setMembers] = useState<CabinetMemberDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessLevel, setAccessLevel] = useState<CabinetAccessLevel>('READ');

  const memberUserIds = useMemo(
    () => members.map((member) => member.userId),
    [members],
  );

  const loadMembers = useCallback(async () => {
    if (!cabinetId) return;
    setLoading(true);
    try {
      const result = await getCabinetWithMembers(dispensarySlug, cabinetId);
      const data = handleAction(result);
      if (data) {
        setMembers(data.members as CabinetMemberDTO[]);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Chargement impossible',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [cabinetId, dispensarySlug]);

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
    if (opened && cabinetId) {
      void loadMembers();
    }
  }, [opened, cabinetId, loadMembers]);

  const handleAddMember = async (userId: string) => {
    if (!cabinetId) return;
    try {
      const result = await upsertCabinetMember(dispensarySlug, {
        cabinetId,
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

  const handleUpdateLevel = async (userId: string, level: CabinetAccessLevel) => {
    if (!cabinetId) return;
    try {
      const result = await upsertCabinetMember(dispensarySlug, {
        cabinetId,
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
    if (!cabinetId) return;
    try {
      const result = await removeCabinetMember(dispensarySlug, { cabinetId, userId });
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
      title={`Membres — ${cabinetName}`}
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
        <Group align="flex-end" grow>
          <UserPseudoSearch
            enabled={opened}
            inputName="cabinet-member-user-search"
            excludeUserIds={memberUserIds}
            onSearch={searchCabinetUsers}
            onSelect={(user) => void handleAddMember(user.id)}
            actionLabel="Ajouter"
          />
          <Select
            label="Permission"
            data={CABINET_ACCESS_LEVELS.map((l) => ({
              value: l,
              label: cabinetAccessLevelLabel(l),
            }))}
            value={accessLevel}
            onChange={(v) => setAccessLevel((v as CabinetAccessLevel) ?? 'READ')}
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
                data={CABINET_ACCESS_LEVELS.map((l) => ({
                  value: l,
                  label: cabinetAccessLevelLabel(l),
                }))}
                value={member.accessLevel}
                onChange={(v) =>
                  handleUpdateLevel(member.userId, (v as CabinetAccessLevel) ?? member.accessLevel)
                }
              />
              <ActionIcon
                variant="light"
                color="danger"
                onClick={() => void handleRemove(member.userId)}
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
