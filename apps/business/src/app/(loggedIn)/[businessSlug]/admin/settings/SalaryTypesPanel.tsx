'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCoin, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  createPayrollSalaryType,
  deletePayrollSalaryType,
  updatePayrollPatientCare,
  updatePayrollSalaryType,
} from '@/app/_actions/payrollSalaryTypes';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { PAYROLL_CAISSE_USD, PAYROLL_MAX_USD } from '@/lib/payroll/constants';
import type { PayrollSalaryTypeDTO } from '@/lib/payroll/salaryTypes';

type SalaryTypeForm = {
  id: string | null;
  label: string;
  caisseUnitUsd: number;
  isDefault: boolean;
  isCashPreparerDefault: boolean;
};

const usd = (value: number) => `${value.toFixed(2)} $`;

function showError(res: object, fallback: string) {
  const error = 'error' in res ? res.error : undefined;
  notifications.show({
    title: 'Erreur',
    message: typeof error === 'string' ? error : fallback,
    color: 'danger',
  });
}

export function SalaryTypesPanel({
  businessSlug,
  initialSalaryTypes,
  initialPatientCareUsd,
  error,
}: {
  businessSlug: string;
  initialSalaryTypes: PayrollSalaryTypeDTO[];
  initialPatientCareUsd: number;
  error?: string;
}) {
  const [salaryTypes, setSalaryTypes] = useState(initialSalaryTypes);
  const [form, setForm] = useState<SalaryTypeForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [patientCareUsd, setPatientCareUsd] = useState(initialPatientCareUsd);
  const [savedPatientCareUsd, setSavedPatientCareUsd] = useState(initialPatientCareUsd);
  const [savingPatientCare, setSavingPatientCare] = useState(false);

  const submitForm = async () => {
    if (!form) return;
    setSaving(true);
    const input = {
      label: form.label,
      caisseUnitUsd: form.caisseUnitUsd,
      isDefault: form.isDefault,
      isCashPreparerDefault: form.isCashPreparerDefault,
    };
    const res = form.id
      ? await updatePayrollSalaryType(businessSlug, { id: form.id, ...input })
      : await createPayrollSalaryType(businessSlug, input);
    setSaving(false);
    if (res.status !== 200 || !('data' in res) || !res.data) {
      showError(res, 'Échec de l’enregistrement du salaire');
      return;
    }
    setSalaryTypes(res.data);
    setForm(null);
    notifications.show({ title: 'Enregistré', message: `Salaire « ${input.label.trim()} » enregistré.`, color: 'moss' });
  };

  const remove = async (salaryType: PayrollSalaryTypeDTO) => {
    const res = await deletePayrollSalaryType(businessSlug, salaryType.id);
    if (res.status !== 200 || !('data' in res) || !res.data) {
      showError(res, 'Échec de la suppression du salaire');
      return;
    }
    setSalaryTypes(res.data);
    notifications.show({ title: 'Supprimé', message: `Salaire « ${salaryType.label} » supprimé.`, color: 'moss' });
  };

  const savePatientCare = async () => {
    setSavingPatientCare(true);
    const res = await updatePayrollPatientCare(businessSlug, { patientCareUsd });
    setSavingPatientCare(false);
    if (res.status !== 200 || !('data' in res) || !res.data) {
      showError(res, 'Échec de la mise à jour du tarif patient');
      return;
    }
    setSavedPatientCareUsd(res.data.patientCareUsd);
    notifications.show({ title: 'Enregistré', message: 'Le tarif patient a été mis à jour.', color: 'moss' });
  };

  return (
    <Stack gap="lg">
      <Card withBorder shadow="sm" radius="md" padding="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>Types de salaire</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Montant reversé par caisse. On attribue un salaire à chaque personne dans Gestion ›
                Personnes ; sans salaire attribué, c’est celui par défaut qui s’applique (sinon{' '}
                {usd(PAYROLL_CAISSE_USD)}).
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                setForm({
                  id: null,
                  label: '',
                  caisseUnitUsd: PAYROLL_CAISSE_USD,
                  isDefault: salaryTypes.length === 0,
                  isCashPreparerDefault: false,
                })
              }
            >
              Ajouter
            </Button>
          </Group>

          {error ? (
            <Text c="danger">{error}</Text>
          ) : salaryTypes.length === 0 ? (
            <Text size="sm" c="dimmed">
              Aucun type de salaire : tout le monde est payé {usd(PAYROLL_CAISSE_USD)} par caisse.
            </Text>
          ) : (
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Libellé</Table.Th>
                  <Table.Th>Par caisse</Table.Th>
                  <Table.Th>Personnes</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {salaryTypes.map((salaryType) => (
                  <Table.Tr key={salaryType.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Text fw={600}>{salaryType.label}</Text>
                        {salaryType.isDefault && (
                          <Badge size="sm" variant="light">
                            Par défaut
                          </Badge>
                        )}
                        {salaryType.isCashPreparerDefault && (
                          <Badge size="sm" variant="light" color="leather">
                            Défaut préparateurs
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {usd(salaryType.caisseUnitUsd)}
                    </Table.Td>
                    <Table.Td>{salaryType.peopleCount}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          aria-label="Modifier"
                          onClick={() => setForm({ ...salaryType })}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <DeleteConfirmPopover
                          title="Supprimer ce salaire ?"
                          message={
                            salaryType.peopleCount > 0
                              ? `${salaryType.peopleCount} personne(s) passeront au salaire par défaut.`
                              : 'Personne n’a ce salaire.'
                          }
                          confirmLabel="Supprimer"
                          onConfirm={() => remove(salaryType)}
                        >
                          <ActionIcon variant="subtle" color="danger" aria-label="Supprimer">
                            <IconTrash size={16} />
                          </ActionIcon>
                        </DeleteConfirmPopover>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" padding="lg">
        <Stack gap="md">
          <div>
            <Title order={4}>Tarif patient</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Bonus par patient soigné (hors soins shérif), le même pour tous les salaires.
            </Text>
          </div>
          <Group align="flex-end">
            <NumberInput
              label="Par patient soigné"
              min={0.01}
              max={PAYROLL_MAX_USD}
              step={0.05}
              decimalScale={2}
              suffix=" $"
              value={patientCareUsd}
              onChange={(v) => setPatientCareUsd(typeof v === 'number' ? v : 0)}
              maw={200}
            />
            <Button
              onClick={savePatientCare}
              loading={savingPatientCare}
              disabled={patientCareUsd === savedPatientCareUsd}
            >
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </Card>

      <AppModal
        opened={form != null}
        onClose={() => setForm(null)}
        title={form?.id ? 'Modifier le salaire' : 'Nouveau salaire'}
        icon={IconCoin}
        size="md"
      >
        {form && (
          <Stack gap="md">
            <TextInput
              label="Libellé"
              placeholder="Employé, Préparateur de caisse…"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.currentTarget.value })}
              maxLength={60}
              data-autofocus
            />
            <NumberInput
              label="Reversé par caisse"
              min={0.01}
              max={PAYROLL_MAX_USD}
              step={0.5}
              decimalScale={2}
              suffix=" $"
              value={form.caisseUnitUsd}
              onChange={(v) => setForm({ ...form, caisseUnitUsd: typeof v === 'number' ? v : 0 })}
            />
            <Checkbox
              label="Salaire par défaut"
              description="Pour les personnes sans salaire attribué, et comme prix de caisse des nouveaux rapports."
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.currentTarget.checked })}
            />
            <Checkbox
              label="Salaire par défaut des préparateurs de caisses"
              description="Pour les préparateurs sans salaire attribué, dans le rapport « Préparateurs de caisse ». Sans ce choix, ils prennent le salaire par défaut."
              checked={form.isCashPreparerDefault}
              onChange={(e) => setForm({ ...form, isCashPreparerDefault: e.currentTarget.checked })}
            />
            <AppModalFooter>
              <Button variant="default" onClick={() => setForm(null)}>
                Annuler
              </Button>
              <Button onClick={submitForm} loading={saving} disabled={!form.label.trim()}>
                Enregistrer
              </Button>
            </AppModalFooter>
          </Stack>
        )}
      </AppModal>
    </Stack>
  );
}
