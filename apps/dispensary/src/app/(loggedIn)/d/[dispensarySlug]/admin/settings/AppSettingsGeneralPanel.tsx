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
import { updateAppSettings, type DispensarySettingsAdminDTO } from '@/app/_actions/appSettings';
import { slugifyDispensaryName } from '@/lib/dispensary/slug';
import { tenantRoutes } from '@/types/routes';

type FeatureToggle = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function AppSettingsGeneralPanel({
  dispensarySlug,
  initial,
}: {
  dispensarySlug: string;
  initial: DispensarySettingsAdminDTO;
}) {
  const router = useRouter();
  const [dispensaryName, setDispensaryName] = useState(initial.dispensaryName);
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
  const [featureWeeklyDispensaryActivityEnabled, setFeatureWeeklyDispensaryActivityEnabled] =
    useState(initial.featureWeeklyDispensaryActivityEnabled);
  const [featureAgendaEnabled, setFeatureAgendaEnabled] = useState(
    initial.featureAgendaEnabled,
  );
  const [featureCabinetEnabled, setFeatureCabinetEnabled] = useState(
    initial.featureCabinetEnabled ?? true,
  );
  const [featureSalesEnabled, setFeatureSalesEnabled] = useState(
    initial.featureSalesEnabled ?? true,
  );
  const [weeklyActivityChestDaysVisible, setWeeklyActivityChestDaysVisible] = useState(
    initial.weeklyActivityChestDaysVisible ?? true,
  );
  const [weeklyActivityPresenceDaysVisible, setWeeklyActivityPresenceDaysVisible] = useState(
    initial.weeklyActivityPresenceDaysVisible ?? true,
  );
  const [weeklyActivityPatientsVisible, setWeeklyActivityPatientsVisible] = useState(
    initial.weeklyActivityPatientsVisible ?? true,
  );
  const [weeklyActivitySherifsVisible, setWeeklyActivitySherifsVisible] = useState(
    initial.weeklyActivitySherifsVisible ?? true,
  );
  const [weeklyActivityInfusionsVisible, setWeeklyActivityInfusionsVisible] = useState(
    initial.weeklyActivityInfusionsVisible ?? true,
  );
  const [weeklyActivityPoppyMilkVisible, setWeeklyActivityPoppyMilkVisible] = useState(
    initial.weeklyActivityPoppyMilkVisible ?? true,
  );
  const [submitting, setSubmitting] = useState(false);

  const featureToggles: FeatureToggle[] = [
    { label: 'Stock', checked: featureStockEnabled, onChange: setFeatureStockEnabled },
    { label: 'Banque', checked: featureBankEnabled, onChange: setFeatureBankEnabled },
    { label: 'Commandes', checked: featureOrdersEnabled, onChange: setFeatureOrdersEnabled },
    { label: 'Recherche', checked: featureSearchEnabled, onChange: setFeatureSearchEnabled },
    { label: 'Courriers', checked: featureMailsEnabled, onChange: setFeatureMailsEnabled },
    {
      label: 'Rapports salaires',
      checked: featurePayrollEnabled,
      onChange: setFeaturePayrollEnabled,
    },
    {
      label: 'Activité hebdomadaire (dispensaire)',
      checked: featureWeeklyDispensaryActivityEnabled,
      onChange: setFeatureWeeklyDispensaryActivityEnabled,
    },
    { label: 'Agenda & to-do', checked: featureAgendaEnabled, onChange: setFeatureAgendaEnabled },
    {
      label: 'Cabinet médical',
      checked: featureCabinetEnabled,
      onChange: setFeatureCabinetEnabled,
    },
    { label: 'Ventes', checked: featureSalesEnabled, onChange: setFeatureSalesEnabled },
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
    {
      label: 'Patients',
      checked: weeklyActivityPatientsVisible,
      onChange: setWeeklyActivityPatientsVisible,
    },
    {
      label: 'Shérifs',
      checked: weeklyActivitySherifsVisible,
      onChange: setWeeklyActivitySherifsVisible,
    },
    {
      label: 'Infusions',
      checked: weeklyActivityInfusionsVisible,
      onChange: setWeeklyActivityInfusionsVisible,
    },
    {
      label: 'Lait de pavot',
      checked: weeklyActivityPoppyMilkVisible,
      onChange: setWeeklyActivityPoppyMilkVisible,
    },
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await updateAppSettings(dispensarySlug, {
      dispensaryName,
      slug: slug.trim().toLowerCase(),
      featureStockEnabled,
      featureBankEnabled,
      featureOrdersEnabled,
      featureSearchEnabled,
      featureMailsEnabled,
      featurePayrollEnabled,
      featureWeeklyDispensaryActivityEnabled,
      featureAgendaEnabled,
      featureCabinetEnabled,
      featureSalesEnabled,
      weeklyActivityChestDaysVisible,
      weeklyActivityPresenceDaysVisible,
      weeklyActivityPatientsVisible,
      weeklyActivitySherifsVisible,
      weeklyActivityInfusionsVisible,
      weeklyActivityPoppyMilkVisible,
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

    if (res.data.slug !== dispensarySlug) {
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
            value={dispensaryName}
            onChange={(e) => setDispensaryName(e.currentTarget.value)}
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
              onClick={() => setSlug(slugifyDispensaryName(dispensaryName))}
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
            {featureToggles.map((toggle) => (
              <Switch
                key={toggle.label}
                color="sage"
                label={toggle.label}
                checked={toggle.checked}
                onChange={(e) => toggle.onChange(e.currentTarget.checked)}
              />
            ))}
          </SimpleGrid>

          {featureWeeklyDispensaryActivityEnabled && (
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
