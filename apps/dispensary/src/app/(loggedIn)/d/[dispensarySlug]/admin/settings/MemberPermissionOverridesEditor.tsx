'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Group,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSearch } from '@tabler/icons-react';
import {
  listCatalogPermissionEntries,
  parsePermissionKey,
  type ApplicationResource,
} from '@lawless-intranet/auth-permissions';
import {
  getDispensaryMemberPermissionOverrides,
  setDispensaryMemberPermissionOverrides,
} from '@/app/_actions/dispensaryPermissions';

type OverrideEffect = 'inherit' | 'grant' | 'deny';

export function MemberPermissionOverridesEditor({
  dispensarySlug,
  userId,
  userName,
  onClose,
}: {
  dispensarySlug: string;
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const catalogEntries = useMemo(() => listCatalogPermissionEntries(), []);
  const [effects, setEffects] = useState<Record<string, OverrideEffect>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await getDispensaryMemberPermissionOverrides(dispensarySlug, userId);
      if (cancelled) return;
      const next: Record<string, OverrideEffect> = {};
      for (const entry of catalogEntries) {
        next[entry.key] = 'inherit';
      }
      if (result.status === 200 && result.data) {
        for (const row of result.data) {
          next[row.key] = row.effect;
        }
      }
      setEffects(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogEntries, dispensarySlug, userId]);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const overrides = Object.entries(effects)
        .filter(([, effect]) => effect !== 'inherit')
        .map(([key, effect]) => {
          const parsed = parsePermissionKey(key);
          if (!parsed || (effect !== 'grant' && effect !== 'deny')) {
            return null;
          }
          return {
            resource: parsed.resource as ApplicationResource,
            action: parsed.action,
            effect,
          };
        })
        .filter((o): o is NonNullable<typeof o> => o != null);

      const result = await setDispensaryMemberPermissionOverrides(dispensarySlug, {
        userId,
        overrides,
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
        message: `Overrides de ${userName} mis à jour`,
        color: 'moss',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="md">
      <Text c="dimmed" size="sm">
        Hérité = droits du/des rôle(s). Accorder / Refuser = exception pour ce membre.
      </Text>

      <TextInput
        placeholder="Rechercher une permission (ex. stock:view)…"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />

      <ScrollArea.Autosize mah="min(60vh, 520px)" type="auto" offsetScrollbars>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Permission</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Effet</Table.Th>
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
                    <Select
                      size="xs"
                      data={[
                        { value: 'inherit', label: 'Hérité' },
                        { value: 'grant', label: 'Accorder' },
                        { value: 'deny', label: 'Refuser' },
                      ]}
                      value={effects[entry.key] ?? 'inherit'}
                      onChange={(value) => {
                        if (!value) return;
                        setEffects((prev) => ({
                          ...prev,
                          [entry.key]: value as OverrideEffect,
                        }));
                      }}
                      disabled={loading}
                      allowDeselect={false}
                    />
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>

      <Group justify="flex-end">
        <Button variant="subtle" color="slate" onClick={onClose}>
          Fermer
        </Button>
        <Button color="sage" loading={saving || loading} onClick={handleSave}>
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}
