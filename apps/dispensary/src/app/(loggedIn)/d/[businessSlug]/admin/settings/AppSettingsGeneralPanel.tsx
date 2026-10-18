'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { updateAppSettings, type BusinessSettingsAdminDTO } from '@/app/_actions/appSettings';
import { slugifyBusinessName } from '@/lib/business/slug';
import { tenantRoutes } from '@/types/routes';
import { isModuleAllowedForType } from '@/lib/businessTypes';
import type { AppFeatureKey } from '@/lib/appFeatures';
import {
  isWeeklyCounterEnabled,
  weeklyCounterDefinitions,
} from '@/lib/businessWeeklyActivity/counters';

type FeatureToggle = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function AppSettingsGeneralPanel({
  businessSlug,
  initial,
}: {
  businessSlug: string;
  initial: BusinessSettingsAdminDTO;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [slug, setSlug] = useState(initial.slug);
  const [featureStockEnabled, setFeatureStockEnabled] = useState(
    initial.featureStockEnabled,
  );
  const [featureBankEnabled, setFeatureBankEnabled] = useState(
    initial.featureBankEnabled,
  );
  const [featureOrdersEnabled, setFeatureOrdersEnabled] = useState(
    initial.featureOrdersEnabled,
  );
  const [featureSearchEnabled, setFeatureSearchEnabled] = useState(
    initial.featureSearchEnabled,
  );
  const [featureMailsEnabled, setFeatureMailsEnabled] = useState(
    initial.featureMailsEnabled,
  );
  const [featurePayrollEnabled, setFeaturePayrollEnabled] = useState(
    initial.featurePayrollEnabled,
  );
  const [featureWeeklyActivityEnabled, setFeatureWeeklyActivityEnabled] =
    useState(initial.featureWeeklyActivityEnabled);
  const [featureAgendaEnabled, setFeatureAgendaEnabled] = useState(
    initial.featureAgendaEnabled,
  );
  const [featureCabinetEnabled, setFeatureCabinetEnabled] = useState(
    initial.featureCabinetEnabled ?? true,
  );
  const [featureSalesEnabled, setFeatureSalesEnabled] = useState(
    initial.featureSalesEnabled ?? true,
  );
  const [featureMediaEnabled, setFeatureMediaEnabled] = useState(
    initial.featureMediaEnabled ?? true,
  );
  const [weeklyActivityChestDaysVisible, setWeeklyActivityChestDaysVisible] = useState(
    initial.weeklyActivityChestDaysVisible ?? true,
  );
  const [weeklyActivityPresenceDaysVisible, setWeeklyActivityPresenceDaysVisible] = useState(
    initial.weeklyActivityPresenceDaysVisible ?? true,
  );
  const [weeklyActivityCounters, setWeeklyActivityCounters] = useState(
    initial.weeklyActivityCounters,
  );
  const [submitting, setSubmitting] = useState(false);

  const featureToggles: (FeatureToggle & { feature: AppFeatureKey })[] = [
    { feature: 'stock', label: 'Stock', checked: featureStockEnabled, onChange: setFeatureStockEnabled },
    { feature: 'bank', label: 'Banque', checked: featureBankEnabled, onChange: setFeatureBankEnabled },
    { feature: 'orders', label: 'Commandes', checked: featureOrdersEnabled, onChange: setFeatureOrdersEnabled },
    { feature: 'search', label: 'Recherche', checked: featureSearchEnabled, onChange: setFeatureSearchEnabled },
    { feature: 'mails', label: 'Courriers', checked: featureMailsEnabled, onChange: setFeatureMailsEnabled },
    {
      feature: 'payroll',
      label: 'Rapports salaires',
      checked: featurePayrollEnabled,
      onChange: setFeaturePayrollEnabled,
    },
    {
      feature: 'weeklyActivity',
      label: 'Activité hebdomadaire',
      checked: featureWeeklyActivityEnabled,
      onChange: setFeatureWeeklyActivityEnabled,
    },
    { feature: 'agenda', label: 'Agenda & to-do', checked: featureAgendaEnabled, onChange: setFeatureAgendaEnabled },
    {
      feature: 'cabinet',
      label: 'Cabinet médical',
      checked: featureCabinetEnabled,
      onChange: setFeatureCabinetEnabled,
    },
    { feature: 'sales', label: 'Ventes', checked: featureSalesEnabled, onChange: setFeatureSalesEnabled },
    { feature: 'media', label: 'Médiathèque', checked: featureMediaEnabled, onChange: setFeatureMediaEnabled },
  ];

  const weeklyColumnToggles: FeatureToggle[] = [
    {
      label: 'Caisses',
      checked: weeklyActivityChestDaysVisible,
      onChange: setWeeklyActivityChestDaysVisible,
    },
    {
      label: 'Présences',
      checked: weeklyActivityPresenceDaysVisible,
      onChange: setWeeklyActivityPresenceDaysVisible,
    },
    // Counters of the business type (lib/businessTypes).
    ...weeklyCounterDefinitions(initial.businessType).map((counter) => ({
      label: counter.label,
      checked: isWeeklyCounterEnabled(weeklyActivityCounters, counter.key),
      onChange: (checked: boolean) =>
        setWeeklyActivityCounters((prev) => ({ ...prev, [counter.key]: checked })),
    })),
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await updateAppSettings(businessSlug, {
      businessName,
      slug: slug.trim().toLowerCase(),
      featureStockEnabled,
      featureBankEnabled,
      featureOrdersEnabled,
      featureSearchEnabled,
      featureMailsEnabled,
      featurePayrollEnabled,
      featureWeeklyActivityEnabled,
      featureAgendaEnabled,
      featureCabinetEnabled,
      featureSalesEnabled,
      featureMediaEnabled,
      weeklyActivityChestDaysVisible,
      weeklyActivityPresenceDaysVisible,
      weeklyActivityCounters,
    });
    setSubmitting(false);

    if (res.status !== 200 || !('data' in res)) {
      notifications.show({
        title: 'Erreur',
        message: 'error' in res ? res.error : 'Échec de la mise à jour',
        color: 'danger',
      });
      return;
    }

    notifications.show({
      title: 'Enregistré',
      message: 'Les paramètres ont été mis à jour.',
      color: 'moss',
    });

    if (res.data.slug !== businessSlug) {
      router.push(tenantRoutes(res.data.slug).admin.settings);
      router.refresh();
      return;
    }

    router.refresh();
  };

  return (
    <Stack gap="lg">
      <Card withBorder shadow="sm" radius="md" padding="lg">
        <Stack gap="md">
          <div>
            <Title order={4}>Identité</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Nom affiché dans le header et adresse d’accès du dispensaire.
            </Text>
          </div>
          <TextInput
            label="Nom du dispensaire"
            description="Affiché dans le sélecteur du header et le titre du site."
            value={businessName}
            onChange={(e) => setBusinessName(e.currentTarget.value)}
          />
          <Group align="flex-end" wrap="nowrap">
            <TextInput
              label="Slug (URL)"
              description={`Chemin d'accès : /d/${slug || '…'}`}
              style={{ flex: 1 }}
              value={slug}
              onChange={(e) => setSlug(e.currentTarget.value)}
            />
            <Button
              variant="subtle"
              color="slate"
              onClick={() => setSlug(slugifyBusinessName(businessName))}
            >
              Générer depuis le nom
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" padding="lg">
        <Stack gap="lg">
          <div>
            <Title order={4}>Fonctionnalités employés</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Active ou masque les modules visibles pour l’équipe.
            </Text>
          </div>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {featureToggles
              .filter((toggle) => isModuleAllowedForType(initial.businessType, toggle.feature))
              .map((toggle) => (
                <Switch
                  key={toggle.label}
                  color="sage"
                  label={toggle.label}
                  checked={toggle.checked}
                  onChange={(e) => toggle.onChange(e.currentTarget.checked)}
                />
              ))}
          </SimpleGrid>

          {featureWeeklyActivityEnabled && (
            <Stack gap="md" pt="sm">
              <hr className="disp-section-divider" />
              <div>
                <Title order={5}>Activité hebdomadaire — colonnes affichées</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  Décochez un élément pour le masquer dans le tableau et les formulaires
                  (intranet et bot).
                </Text>
              </div>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {weeklyColumnToggles.map((toggle) => (
                  <Switch
                    key={toggle.label}
                    color="sage"
                    label={toggle.label}
                    checked={toggle.checked}
                    onChange={(e) => toggle.onChange(e.currentTarget.checked)}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          )}
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button color="sage" loading={submitting} onClick={handleSubmit}>
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}
