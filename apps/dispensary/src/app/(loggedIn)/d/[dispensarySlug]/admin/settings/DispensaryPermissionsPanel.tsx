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
import { IconSearch } from '@tabler/icons-react';
import {
  listCatalogPermissionEntries,
  parsePermissionKey,
} from '@lawless-intranet/auth-permissions';
import {
  resetDispensaryRolePermissions,
  setDispensaryRolePermissions,
} from '@/app/_actions/dispensaryPermissions';
import {
  DISPENSARY_MEMBER_ROLES,
  type DispensaryMemberRole,
  rolesAsString,
} from '@/types/enum/roles';

export type RolePermissionsMatrixData = {
  catalog: Record<string, readonly string[]>;
  byRole: Record<string, string[]>;
};

export function DispensaryPermissionsPanel({
  dispensarySlug,
  initial,
}: {
  dispensarySlug: string;
  initial: RolePermissionsMatrixData;
}) {
  const catalogEntries = useMemo(() => listCatalogPermissionEntries(), []);
  const [byRole, setByRole] = useState<Record<string, Set<string>>>(() => {
    const next: Record<string, Set<string>> = {};
    for (const role of DISPENSARY_MEMBER_ROLES) {
      next[role] = new Set(initial.byRole[role] ?? []);
    }
    return next;
  });
  const [selectedRole, setSelectedRole] = useState<DispensaryMemberRole>(
    DISPENSARY_MEMBER_ROLES[1] ?? DISPENSARY_MEMBER_ROLES[0],
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return catalogEntries;
    }
    return catalogEntries.filter((entry) => {
      return (
        entry.key.toLowerCase().includes(q) ||
        entry.resource.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q)
      );
    });
  }, [catalogEntries, search]);

  const toggle = (key: string) => {
    setByRole((prev) => {
      const nextSet = new Set(prev[selectedRole] ?? []);
      if (nextSet.has(key)) {
        nextSet.delete(key);
      } else {
        nextSet.add(key);
      }
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

      const result = await setDispensaryRolePermissions(dispensarySlug, {
        role: selectedRole,
        permissions,
      });
      if (result.status !== 200) {
        notifications.show({
          title: 'Erreur',
          message:
            'error' in result && typeof result.error === 'string'
              ? result.error
              : 'Erreur',
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Enregistré',
        message: `Permissions du rôle ${rolesAsString(selectedRole)} mises à jour`,
        color: 'moss',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const result = await resetDispensaryRolePermissions(dispensarySlug);
      if (result.status !== 200) {
        notifications.show({
          title: 'Erreur',
          message:
            'error' in result && typeof result.error === 'string'
              ? result.error
              : 'Erreur',
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Réinitialisé',
        message: 'Matrice remise aux valeurs par défaut',
        color: 'moss',
      });
      window.location.reload();
    } finally {
      setResetting(false);
    }
  };

  const selectedKeys = byRole[selectedRole] ?? new Set<string>();

  return (
    <Stack gap="md">
      <div>
        <Title order={3} className="disp-display-title" fw={400}>
          Permissions par rôle
        </Title>
        <Text c="dimmed" size="sm" mt={4}>
          Configure les droits applicatifs de chaque rôle pour ce dispensaire. Les overrides
          individuels se gèrent dans l’onglet Membres.
        </Text>
      </div>

      <Group justify="space-between" align="flex-end">
        <Group>
          {DISPENSARY_MEMBER_ROLES.map((role) => (
            <Button
              key={role}
              size="xs"
              variant={selectedRole === role ? 'filled' : 'light'}
              color={selectedRole === role ? 'sage' : 'slate'}
              onClick={() => setSelectedRole(role)}
            >
              {rolesAsString(role)}
            </Button>
          ))}
        </Group>
        <Group>
          <Button
            variant="subtle"
            color="slate"
            loading={resetting}
            onClick={handleReset}
          >
            Réinitialiser tous les rôles
          </Button>
          <Button color="sage" loading={saving} onClick={handleSave}>
            Enregistrer ce rôle
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Rechercher une permission (ex. stock:view)…"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />

      <ScrollArea>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Permission</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Autorisé</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredEntries.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    Aucune permission ne correspond à la recherche.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredEntries.map((entry) => (
                <Table.Tr key={entry.key}>
                  <Table.Td>
                    <Text ff="monospace" size="sm">
                      {entry.key}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{entry.description}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      checked={selectedKeys.has(entry.key)}
                      onChange={() => toggle(entry.key)}
                      aria-label={entry.key}
                    />
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
