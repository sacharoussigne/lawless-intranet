'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Group, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  applicationPermissionCatalog,
  listCatalogPermissionKeys,
  parsePermissionKey,
  permissionKey,
} from '@/lib/shelter/permissionsCatalog';
import {
  getShelterMemberPermissionOverrides,
  setShelterMemberPermissionOverrides,
} from '@/app/_actions/shelterPermissions';

type OverrideEffect = 'grant' | 'deny' | 'none';

export function MemberPermissionOverridesEditor({
  shelterSlug,
  userId,
}: {
  shelterSlug: string;
  userId: string;
}) {
  const catalogKeys = useMemo(() => listCatalogPermissionKeys(), []);
  const [effects, setEffects] = useState<Record<string, OverrideEffect>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await getShelterMemberPermissionOverrides(shelterSlug, userId);
      if (cancelled) return;
      const next: Record<string, OverrideEffect> = {};
      for (const key of catalogKeys) {
        next[key] = 'none';
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
  }, [shelterSlug, userId, catalogKeys]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const overrides = Object.entries(effects)
        .filter(([, effect]) => effect !== 'none')
        .map(([key, effect]) => {
          const parsed = parsePermissionKey(key);
          return {
            resource: parsed!.resource,
            action: parsed!.action,
            effect: effect as 'grant' | 'deny',
          };
        });
      const result = await setShelterMemberPermissionOverrides(shelterSlug, {
        userId,
        overrides,
      });
      if (result.status !== 200) {
        const message =
          'error' in result && typeof result.error === 'string' ? result.error : 'Échec';
        notifications.show({
          title: 'Erreur',
          message,
          color: 'red',
        });
        return;
      }
      notifications.show({ title: 'Overrides enregistrés', message: '', color: 'teal' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Text c="dimmed">Chargement…</Text>;
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Accorder ou refuser des permissions individuelles (catalogue refuge).
      </Text>
      {Object.entries(applicationPermissionCatalog).map(([resource, actions]) => (
        <div key={resource}>
          <Title order={5} mb={6}>
            {resource}
          </Title>
          <Stack gap={4}>
            {actions.map((action) => {
              const key = permissionKey(resource, action);
              const effect = effects[key] ?? 'none';
              return (
                <Group key={key} justify="space-between">
                  <Text size="sm">
                    {resource}:{action}
                  </Text>
                  <Group gap="xs">
                    <Checkbox
                      label="Grant"
                      checked={effect === 'grant'}
                      onChange={() =>
                        setEffects((prev) => ({
                          ...prev,
                          [key]: effect === 'grant' ? 'none' : 'grant',
                        }))
                      }
                    />
                    <Checkbox
                      label="Deny"
                      checked={effect === 'deny'}
                      onChange={() =>
                        setEffects((prev) => ({
                          ...prev,
                          [key]: effect === 'deny' ? 'none' : 'deny',
                        }))
                      }
                    />
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </div>
      ))}
      <Button color="teal" loading={saving} onClick={() => void handleSave()}>
        Enregistrer les overrides
      </Button>
    </Stack>
  );
}
