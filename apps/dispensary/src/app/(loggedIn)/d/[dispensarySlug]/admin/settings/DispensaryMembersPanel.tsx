'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  MultiSelect,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconUsers } from '@tabler/icons-react';
import { UserPseudoSearch } from '@/app/_components/UserPseudoSearch/UserPseudoSearch';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import {
  listDispensaryMembers,
  removeDispensaryMember,
  searchUsersForDispensaryInvite,
  upsertDispensaryMember,
} from '@/app/_actions/dispensaryMembers';
import {
  DISPENSARY_MEMBER_ROLES,
  type DispensaryMemberRole,
  Role,
  parseRoleList,
  rolesAsString,
} from '@/types/enum/roles';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import { sagePalette } from '@/lib/design-tokens';

const ROLE_OPTIONS = DISPENSARY_MEMBER_ROLES.map((role) => ({
  value: role,
  label: rolesAsString(role),
}));

export type DispensaryMemberRow = {
  id: string;
  role: string;
  description: string | null;
  user: { id: string; name: string };
};

export function DispensaryMembersPanel({
  dispensarySlug,
  initialMembers,
  error,
}: {
  dispensarySlug: string;
  initialMembers: DispensaryMemberRow[];
  error?: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([Role.EMPLOYEE]);
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [roleEdits, setRoleEdits] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialMembers.map((m) => [m.user.id, parseRoleList(m.role)])),
  );
  const [descriptionEdits, setDescriptionEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialMembers.map((m) => [m.user.id, m.description ?? ''])),
  );

  const memberUserIds = useMemo(
    () => members.map((member) => member.user.id),
    [members],
  );

  const searchUsers = useCallback(
    async (query: string) => {
      const result = await searchUsersForDispensaryInvite(dispensarySlug, query);
      if (result.status === 200 && result.data) {
        return result.data;
      }
      return [];
    },
    [dispensarySlug],
  );

  const refresh = async () => {
    const result = await listDispensaryMembers(dispensarySlug);
    if (result.status === 200 && result.data) {
      const rows = result.data as DispensaryMemberRow[];
      setMembers(rows);
      setRoleEdits(
        Object.fromEntries(rows.map((m) => [m.user.id, parseRoleList(m.role)])),
      );
      setDescriptionEdits(
        Object.fromEntries(rows.map((m) => [m.user.id, m.description ?? ''])),
      );
    }
  };

  const getRolesForMember = (member: DispensaryMemberRow): string[] => {
    if (roleEdits[member.user.id] !== undefined) {
      return roleEdits[member.user.id];
    }
    return parseRoleList(member.role);
  };

  const saveMemberRoles = async (
    userId: string,
    roles: string[],
    options?: { successMessage?: string; description?: string | null },
  ) => {
    if (roles.length === 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Sélectionnez au moins un rôle.',
        color: 'danger',
      });
      return false;
    }

    const result = await upsertDispensaryMember(dispensarySlug, {
      userId,
      roles: roles as DispensaryMemberRole[],
      description: options?.description,
    });

    if (result.status !== 200) {
      const message =
        'error' in result && typeof result.error === 'string' ? result.error : 'Erreur';
      notifications.show({ title: 'Erreur', message, color: 'danger' });
      return false;
    }

    if (options?.successMessage) {
      notifications.show({
        title: 'Enregistré',
        message: options.successMessage,
        color: 'moss',
      });
    }
    await refresh();
    return true;
  };

  const handleAdd = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const ok = await saveMemberRoles(selectedUser.id, selectedRoles, {
        successMessage: 'Membre ajouté',
      });
      if (!ok) return;
      setSelectedUser(null);
      setSelectedRoles([Role.EMPLOYEE]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMember = async (userId: string) => {
    const roles = roleEdits[userId] ?? [];
    setSavingUserId(userId);
    try {
      await saveMemberRoles(userId, roles, {
        successMessage: 'Membre mis à jour',
        description: descriptionEdits[userId] ?? null,
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const rolesChangedForMember = (member: DispensaryMemberRow) => {
    const current = getRolesForMember(member).slice().sort().join(',');
    const original = parseRoleList(member.role).slice().sort().join(',');
    return current !== original;
  };

  const memberChanged = (member: DispensaryMemberRow) => {
    const currentDescription = (descriptionEdits[member.user.id] ?? '').trim();
    const originalDescription = (member.description ?? '').trim();
    return rolesChangedForMember(member) || currentDescription !== originalDescription;
  };

  const handleRemove = async (userId: string) => {
    const result = await removeDispensaryMember(dispensarySlug, userId);
    if (result.status !== 200) {
      const message =
        'error' in result && typeof result.error === 'string' ? result.error : 'Erreur';
      notifications.show({ title: 'Erreur', message, color: 'danger' });
      return;
    }
    notifications.show({
      title: 'Membre retiré',
      message: 'Le membre a été retiré du dispensaire.',
      color: 'moss',
    });
    await refresh();
  };

  return (
    <Stack gap="lg">
      {error && (
        <Text c="danger" size="sm">
          {error}
        </Text>
      )}

      <Card withBorder shadow="sm" radius="md" padding="lg">
        <Stack gap="sm">
          <div>
            <Text fw={600}>Ajouter un membre</Text>
            <Text size="sm" c="dimmed" mt={4}>
              Recherchez un compte utilisateur, attribuez des rôles, puis enregistrez.
            </Text>
          </div>
          <UserPseudoSearch
            inputName="dispensary-member-user-search"
            excludeUserIds={memberUserIds}
            onSearch={searchUsers}
            onSelect={setSelectedUser}
          />
          {selectedUser && (
            <Text size="sm" c="dimmed">
              Sélectionné : {selectedUser.name}
            </Text>
          )}
          <MultiSelect
            label="Rôles"
            data={ROLE_OPTIONS}
            value={selectedRoles}
            onChange={setSelectedRoles}
            searchable
            clearable={false}
          />
          <Group justify="flex-end">
            <Button
              color="sage"
              loading={loading}
              onClick={handleAdd}
              disabled={!selectedUser || selectedRoles.length === 0}
            >
              Ajouter
            </Button>
          </Group>
        </Stack>
      </Card>

      {members.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <IconUsers
            size={40}
            stroke={1.5}
            style={{ color: 'var(--mantine-color-dimmed)' }}
          />
          <Text size="sm" c="dimmed" fw={500} ta="center">
            Aucun membre dans ce dispensaire.
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Title order={5}>Membres ({members.length})</Title>
          {members.map((m) => {
            const memberRoles = getRolesForMember(m);
            return (
              <Card key={m.id} withBorder padding="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={6}>
                      <Text fw={600}>{m.user.name}</Text>
                      <Group gap={6}>
                        {memberRoles.map((role) => (
                          <Badge
                            key={role}
                            variant="outline"
                            radius="sm"
                            style={apothecaryPillStyle(sagePalette)}
                          >
                            {rolesAsString(role as Role)}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                    <DeleteConfirmPopover
                      title="Retirer ce membre ?"
                      message={`« ${m.user.name} » perdra l’accès à ce dispensaire.`}
                      confirmLabel="Retirer"
                      position="left"
                      onConfirm={() => handleRemove(m.user.id)}
                    >
                      <ActionIcon
                        variant="light"
                        color="danger"
                        aria-label={`Retirer ${m.user.name}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </DeleteConfirmPopover>
                  </Group>
                  <MultiSelect
                    label="Rôles"
                    data={ROLE_OPTIONS}
                    value={memberRoles}
                    onChange={(roles) =>
                      setRoleEdits((prev) => ({ ...prev, [m.user.id]: roles }))
                    }
                    searchable
                    clearable={false}
                  />
                  <TextInput
                    label="Grade"
                    placeholder="Directeur, Co-directrice…"
                    value={descriptionEdits[m.user.id] ?? ''}
                    onChange={(event) => {
                      const nextValue =
                        typeof event === 'string'
                          ? event
                          : (event.currentTarget?.value ?? event.target?.value ?? '');
                      setDescriptionEdits((prev) => ({
                        ...prev,
                        [m.user.id]: nextValue,
                      }));
                    }}
                  />
                  <Group justify="flex-end">
                    <Button
                      variant="light"
                      color="sage"
                      loading={savingUserId === m.user.id}
                      disabled={!memberChanged(m) || memberRoles.length === 0}
                      onClick={() => handleSaveMember(m.user.id)}
                    >
                      Enregistrer
                    </Button>
                  </Group>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
