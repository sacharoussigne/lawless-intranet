'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Group,
  MultiSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Modal,
  Combobox,
  useCombobox,
  Loader,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconKey, IconTrash, IconUsers } from '@tabler/icons-react';
import {
  listShelterMembers,
  removeShelterMember,
  searchUsersForShelterInvite,
  upsertShelterMember,
} from '@/app/_actions/shelterMembers';
import {
  SHELTER_MEMBER_ROLES,
  type ShelterMemberRole,
  Role,
  parseRoleList,
  rolesAsString,
} from '@/types/enum/roles';
import { MemberPermissionOverridesEditor } from './MemberPermissionOverridesEditor';

const ROLE_OPTIONS = SHELTER_MEMBER_ROLES.map((role) => ({
  value: role,
  label: rolesAsString(role),
}));

export type ShelterMemberRow = {
  id: string;
  role: string;
  description: string | null;
  user: { id: string; name: string };
};

function UserSearch({
  onSelect,
  excludeIds,
  searchFn,
}: {
  onSelect: (user: { id: string; name: string }) => void;
  excludeIds: string[];
  searchFn: (query: string) => Promise<Array<{ id: string; name: string }>>;
}) {
  const combobox = useCombobox();
  const [query, setQuery] = useState('');
  const [debounced] = useDebouncedValue(query, 250);
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const results = await searchFn(q);
        setOptions(results.filter((u) => !excludeIds.includes(u.id)));
      } finally {
        setLoading(false);
      }
    },
    [excludeIds, searchFn],
  );

  useEffect(() => {
    void runSearch(debounced);
  }, [debounced, runSearch]);

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(value) => {
        const user = options.find((o) => o.id === value);
        if (user) {
          onSelect(user);
          setQuery('');
          setOptions([]);
          combobox.closeDropdown();
        }
      }}
    >
      <Combobox.Target>
        <TextInput
          label="Rechercher un utilisateur"
          placeholder="Pseudo (min. 2 caractères)"
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            combobox.openDropdown();
          }}
          onClick={() => combobox.openDropdown()}
          rightSection={loading ? <Loader size={16} /> : null}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          {options.length === 0 ? (
            <Combobox.Empty>Aucun résultat</Combobox.Empty>
          ) : (
            options.map((u) => (
              <Combobox.Option value={u.id} key={u.id}>
                {u.name}
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

export function ShelterMembersPanel({
  shelterSlug,
  initialMembers,
  error,
}: {
  shelterSlug: string;
  initialMembers: ShelterMemberRow[];
  error?: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([Role.EMPLOYEE]);
  const [newMemberGrade, setNewMemberGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [roleEdits, setRoleEdits] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialMembers.map((m) => [m.user.id, parseRoleList(m.role)])),
  );
  const [descriptionEdits, setDescriptionEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialMembers.map((m) => [m.user.id, m.description ?? ''])),
  );
  const [overridesUser, setOverridesUser] = useState<{ id: string; name: string } | null>(null);

  const memberUserIds = useMemo(() => members.map((m) => m.user.id), [members]);

  const searchUsers = useCallback(
    async (query: string) => {
      const result = await searchUsersForShelterInvite(shelterSlug, query);
      if (result.status === 200 && result.data) {
        return result.data;
      }
      return [];
    },
    [shelterSlug],
  );

  const refresh = async () => {
    const result = await listShelterMembers(shelterSlug);
    if (result.status === 200 && result.data) {
      const rows = result.data as ShelterMemberRow[];
      setMembers(rows);
      setRoleEdits(Object.fromEntries(rows.map((m) => [m.user.id, parseRoleList(m.role)])));
      setDescriptionEdits(Object.fromEntries(rows.map((m) => [m.user.id, m.description ?? ''])));
    }
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
    setSavingUserId(userId);
    try {
      const result = await upsertShelterMember(shelterSlug, {
        userId,
        roles: roles as ShelterMemberRole[],
        description: options?.description,
      });
      if (result.status !== 200) {
        const message =
          'error' in result && typeof result.error === 'string' ? result.error : 'Échec';
        notifications.show({
          title: 'Erreur',
          message,
          color: 'danger',
        });
        return false;
      }
      notifications.show({
        title: 'OK',
        message: options?.successMessage ?? 'Membre mis à jour',
        color: 'terracotta',
      });
      await refresh();
      return true;
    } finally {
      setSavingUserId(null);
    }
  };

  const handleAdd = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const ok = await saveMemberRoles(selectedUser.id, selectedRoles, {
        successMessage: `${selectedUser.name} ajouté`,
        description: newMemberGrade.trim() || null,
      });
      if (ok) {
        setSelectedUser(null);
        setSelectedRoles([Role.EMPLOYEE]);
        setNewMemberGrade('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    const result = await removeShelterMember(shelterSlug, userId);
    if (result.status !== 200) {
      const message =
        'error' in result && typeof result.error === 'string'
          ? result.error
          : 'Suppression impossible';
      notifications.show({
        title: 'Erreur',
        message,
        color: 'danger',
      });
      return;
    }
    notifications.show({ title: 'Membre retiré', message: '', color: 'terracotta' });
    await refresh();
  };

  return (
    <Stack gap="lg">
      <div>
        <Group gap="xs" mb="xs">
          <IconUsers size={20} />
          <Title order={3}>Membres</Title>
        </Group>
        {error ? <Text c="red">{error}</Text> : null}
      </div>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <UserSearch
            excludeIds={memberUserIds}
            searchFn={searchUsers}
            onSelect={setSelectedUser}
          />
          {selectedUser ? (
            <Text size="sm">
              Sélectionné : <strong>{selectedUser.name}</strong>
            </Text>
          ) : null}
          <MultiSelect
            label="Rôles"
            data={ROLE_OPTIONS}
            value={selectedRoles}
            onChange={setSelectedRoles}
          />
          <TextInput
            label="Grade / description"
            value={newMemberGrade}
            onChange={(e) => setNewMemberGrade(e.currentTarget.value)}
          />
          <Button
            color="terracotta"
            loading={loading}
            disabled={!selectedUser}
            onClick={handleAdd}
          >
            Ajouter
          </Button>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {members.map((member) => (
          <Card key={member.id} withBorder padding="md" radius="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>{member.user.name}</Text>
              <Group gap={4}>
                <ActionIcon
                  variant="light"
                  color="terracotta"
                  aria-label="Permissions"
                  onClick={() => setOverridesUser(member.user)}
                >
                  <IconKey size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="danger"
                  aria-label="Retirer"
                  onClick={() => void handleRemove(member.user.id)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
            <MultiSelect
              label="Rôles"
              data={ROLE_OPTIONS}
              value={roleEdits[member.user.id] ?? parseRoleList(member.role)}
              onChange={(roles) =>
                setRoleEdits((prev) => ({ ...prev, [member.user.id]: roles }))
              }
              mb="sm"
            />
            <TextInput
              label="Description"
              value={descriptionEdits[member.user.id] ?? ''}
              onChange={(e) =>
                setDescriptionEdits((prev) => ({
                  ...prev,
                  [member.user.id]: e.currentTarget.value,
                }))
              }
              mb="sm"
            />
            <Button
              size="xs"
              variant="light"
              color="terracotta"
              loading={savingUserId === member.user.id}
              onClick={() =>
                void saveMemberRoles(
                  member.user.id,
                  roleEdits[member.user.id] ?? parseRoleList(member.role),
                  { description: descriptionEdits[member.user.id] ?? null },
                )
              }
            >
              Enregistrer
            </Button>
          </Card>
        ))}
      </SimpleGrid>

      <Modal
        opened={overridesUser != null}
        onClose={() => setOverridesUser(null)}
        title={overridesUser ? `Permissions — ${overridesUser.name}` : 'Permissions'}
        size="lg"
      >
        {overridesUser ? (
          <MemberPermissionOverridesEditor
            shelterSlug={shelterSlug}
            userId={overridesUser.id}
          />
        ) : null}
      </Modal>
    </Stack>
  );
}
