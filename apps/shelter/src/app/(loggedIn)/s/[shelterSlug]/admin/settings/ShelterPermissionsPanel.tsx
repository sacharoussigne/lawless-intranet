'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  listCatalogPermissionKeys,
  parsePermissionKey,
} from '@/lib/shelter/permissionsCatalog';
import {
  resetShelterRolePermissions,
  setShelterRolePermissions,
} from '@/app/_actions/shelterPermissions';
import {
  SHELTER_MEMBER_ROLES,
  type ShelterMemberRole,
  rolesAsString,
} from '@/types/enum/roles';

export type RolePermissionsMatrixData = {
  catalog: Record<string, readonly string[]>;
  byRole: Record<string, string[]>;
};

export function ShelterPermissionsPanel({
  shelterSlug,
  initial,
}: {
  shelterSlug: string;
  initial: RolePermissionsMatrixData;
}) {
  const catalogEntries = useMemo(() => {
    return listCatalogPermissionKeys().map((key) => {
      const parsed = parsePermissionKey(key)!;
      return { key, resource: parsed.resource, action: parsed.action };
    });
  }, []);

  const [byRole, setByRole] = useState<Record<string, Set<string>>>(() => {
    const next: Record<string, Set<string>> = {};
    for (const role of SHELTER_MEMBER_ROLES) {
      next[role] = new Set(initial.byRole[role] ?? []);
    }
    return next;
  });
  const [selectedRole, setSelectedRole] = useState<ShelterMemberRole>(
    SHELTER_MEMBER_ROLES[1] ?? SHELTER_MEMBER_ROLES[0],
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalogEntries;
    return catalogEntries.filter(
      (entry) =>
        entry.key.toLowerCase().includes(q) ||
        entry.resource.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q),
    );
  }, [catalogEntries, search]);

  const toggle = (key: string) => {
    setByRole((prev) => {
      const nextSet = new Set(prev[selectedRole] ?? []);
      if (nextSet.has(key)) nextSet.delete(key);
      else nextSet.add(key);
      return { ...prev, [selectedRole]: nextSet };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const keys = [...(byRole[selectedRole] ?? [])];
      const permissions = keys
        .map((key) => parsePermissionKey(key))
        .filter((p): p is NonNullable<typeof p> => p != null);

      const result = await setShelterRolePermissions(shelterSlug, {
        role: selectedRole,
        permissions,
      });
      if (result.status !== 200) {
        const message =
          'error' in result && typeof result.error === 'string' ? result.error : 'Échec';
        notifications.show({
          title: 'Erreur',
          message,
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Permissions enregistrées',
        message: rolesAsString(selectedRole),
        color: 'terracotta',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const result = await resetShelterRolePermissions(shelterSlug);
      if (result.status !== 200) {
        const message =
          'error' in result && typeof result.error === 'string' ? result.error : 'Échec';
        notifications.show({
          title: 'Erreur',
          message,
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Réinitialisé',
        message: 'Matrice par défaut restaurée',
        color: 'terracotta',
      });
      window.location.reload();
    } finally {
      setResetting(false);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Permissions par rôle</Title>
        <Button variant="light" color="gray" loading={resetting} onClick={() => void handleReset()}>
          Réinitialiser
        </Button>
      </Group>

      <Group>
        {SHELTER_MEMBER_ROLES.map((role) => (
          <Button
            key={role}
            variant={selectedRole === role ? 'filled' : 'light'}
            color="terracotta"
            onClick={() => setSelectedRole(role)}
          >
            {rolesAsString(role)}
          </Button>
        ))}
      </Group>

      <TextInput
        placeholder="Filtrer…"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      <ScrollArea h={360}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Permission</Table.Th>
              <Table.Th>Actif</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredEntries.map((entry) => (
              <Table.Tr key={entry.key}>
                <Table.Td>
                  <Text size="sm">{entry.key}</Text>
                </Table.Td>
                <Table.Td>
                  <Checkbox
                    checked={(byRole[selectedRole] ?? new Set()).has(entry.key)}
                    onChange={() => toggle(entry.key)}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <Button color="terracotta" loading={saving} onClick={() => void handleSave()}>
        Enregistrer le rôle {rolesAsString(selectedRole)}
      </Button>
    </Stack>
  );
}
