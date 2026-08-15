'use client';

import { useState } from 'react';
import { Button, Card, Stack, Switch, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { updateAppSettings, type ShelterSettingsAdminDTO } from '@/app/_actions/shelterSettings';
import { useRouter } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export function ShelterSettingsGeneralPanel({
  shelterSlug,
  initial,
}: {
  shelterSlug: string;
  initial: ShelterSettingsAdminDTO;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.shelterName);
  const [slug, setSlug] = useState(initial.slug);
  const [bankEnabled, setBankEnabled] = useState(initial.featureBankEnabled);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateAppSettings(shelterSlug, {
        shelterName: name,
        slug,
        featureBankEnabled: bankEnabled,
      });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: 'error' in result && typeof result.error === 'string' ? result.error : 'Échec',
          color: 'danger',
        });
        return;
      }
      notifications.show({ title: 'Paramètres enregistrés', message: '', color: 'terracotta' });
      if (result.data.slug !== shelterSlug) {
        router.push(tenantRoutes(result.data.slug).admin.settings);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="md">
        <Title order={3}>Général</Title>
        <TextInput label="Nom du refuge" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Slug" value={slug} onChange={(e) => setSlug(e.currentTarget.value)} />
        <Switch
          label="Module banque activé"
          checked={bankEnabled}
          onChange={(e) => setBankEnabled(e.currentTarget.checked)}
        />
        <Button color="terracotta" loading={saving} onClick={() => void handleSave()}>
          Enregistrer
        </Button>
      </Stack>
    </Card>
  );
}
