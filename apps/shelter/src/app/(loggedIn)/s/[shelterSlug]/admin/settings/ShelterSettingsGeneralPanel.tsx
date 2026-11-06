'use client';

import { useState } from 'react';
import { Button, Card, NumberInput, Stack, Switch, TextInput, Title } from '@mantine/core';
import { MAX_RP_YEAR_OFFSET, MIN_RP_YEAR_OFFSET } from '@lawless-intranet/types';
import { notifications } from '@mantine/notifications';
import { updateAppSettings, type ShelterSettingsAdminDTO } from '@/app/_actions/shelterSettings';
import { useRouter } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { createRpCalendar } from '@/lib/rpCalendar';

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
  const [mediaEnabled, setMediaEnabled] = useState(initial.featureMediaEnabled);
  const [rpYearOffset, setRpYearOffset] = useState<number | ''>(initial.rpYearOffset);
  const [saving, setSaving] = useState(false);
  const rpYearOffsetPreview =
    typeof rpYearOffset === 'number' &&
    rpYearOffset >= MIN_RP_YEAR_OFFSET &&
    rpYearOffset <= MAX_RP_YEAR_OFFSET
      ? createRpCalendar(rpYearOffset).formatRpDate(new Date(), 'd MMMM yyyy')
      : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateAppSettings(shelterSlug, {
        shelterName: name,
        slug,
        featureBankEnabled: bankEnabled,
        featureMediaEnabled: mediaEnabled,
        // Empty field: the server answers with its validation message.
        rpYearOffset: rpYearOffset === '' ? Number.NaN : rpYearOffset,
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
        <NumberInput
          label="Écart du calendrier RP (années)"
          description={
            rpYearOffsetPreview
              ? `Aujourd’hui en RP : ${rpYearOffsetPreview}. Les dates enregistrées ne changent pas, seul l’affichage suit l’écart.`
              : `Entre ${MIN_RP_YEAR_OFFSET} et ${MAX_RP_YEAR_OFFSET} ans`
          }
          min={MIN_RP_YEAR_OFFSET}
          max={MAX_RP_YEAR_OFFSET}
          allowDecimal={false}
          allowNegative={false}
          value={rpYearOffset}
          onChange={(value) => setRpYearOffset(typeof value === 'number' ? value : '')}
        />
        <Switch
          label="Module banque activé"
          checked={bankEnabled}
          onChange={(e) => setBankEnabled(e.currentTarget.checked)}
        />
        <Switch
          label="Module médiathèque activé"
          checked={mediaEnabled}
          onChange={(e) => setMediaEnabled(e.currentTarget.checked)}
        />
        <Button color="terracotta" loading={saving} onClick={() => void handleSave()}>
          Enregistrer
        </Button>
      </Stack>
    </Card>
  );
}
