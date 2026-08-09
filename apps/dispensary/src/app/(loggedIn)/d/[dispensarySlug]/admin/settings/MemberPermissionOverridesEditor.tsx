'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  listCatalogPermissionKeys,
  parsePermissionKey,
  type ApplicationResource,
} from '@lawless-intranet/auth-permissions';
import {
  getDispensaryMemberPermissionOverrides,
  setDispensaryMemberPermissionOverrides,
} from '@/app/_actions/dispensaryPermissions';

const RESOURCE_LABELS: Record<string, string> = {
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
  const catalogKeys = useMemo(() => listCatalogPermissionKeys(), []);
  const [effects, setEffects] = useState<Record<string, OverrideEffect>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await getDispensaryMemberPermissionOverrides(dispensarySlug, userId);
      if (cancelled) return;
      const next: Record<string, OverrideEffect> = {};
      for (const key of catalogKeys) {
        next[key] = 'inherit';
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
  }, [catalogKeys, dispensarySlug, userId]);

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

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Permission</Table.Th>
            <Table.Th>Effet</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {catalogKeys.map((key) => {
            const parsed = parsePermissionKey(key);
            if (!parsed) return null;
            const label = `${RESOURCE_LABELS[parsed.resource] ?? parsed.resource} · ${parsed.action}`;
            return (
              <Table.Tr key={key}>
                <Table.Td>
                  <Text size="sm">{label}</Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={[
                      { value: 'inherit', label: 'Hérité' },
                      { value: 'grant', label: 'Accorder' },
                      { value: 'deny', label: 'Refuser' },
                    ]}
                    value={effects[key] ?? 'inherit'}
                    onChange={(value) => {
                      if (!value) return;
                      setEffects((prev) => ({
                        ...prev,
                        [key]: value as OverrideEffect,
                      }));
                    }}
                    disabled={loading}
                    allowDeselect={false}
                  />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

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
