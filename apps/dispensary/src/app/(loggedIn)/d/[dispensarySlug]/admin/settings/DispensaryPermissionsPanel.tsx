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
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  listCatalogPermissionKeys,
  parsePermissionKey,
  type ApplicationResource,
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

const RESOURCE_LABELS: Record<ApplicationResource, string> = {
  stock: 'Stock',
  orders: 'Commandes',
  search: 'Recherche',
  bank: 'Banque',
  application: 'Application',
  mails: 'Courriers',
  payroll_reports: 'Paie',
  weekly_dispensary_activity: 'Activité hebdo',
  sales: 'Ventes',
  stock_statistics: 'Stats stock',
};

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
  const catalogKeys = useMemo(() => listCatalogPermissionKeys(), []);
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
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

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

      <ScrollArea>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ressource</Table.Th>
              <Table.Th>Action</Table.Th>
              <Table.Th>Autorisé</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {catalogKeys.map((key) => {
              const parsed = parsePermissionKey(key);
              if (!parsed) return null;
              const resourceLabel =
                RESOURCE_LABELS[parsed.resource as ApplicationResource] ?? parsed.resource;
              return (
                <Table.Tr key={key}>
                  <Table.Td>{resourceLabel}</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="sm">
                      {parsed.action}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      checked={selectedKeys.has(key)}
                      onChange={() => toggle(key)}
                      aria-label={`${resourceLabel} ${parsed.action}`}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
