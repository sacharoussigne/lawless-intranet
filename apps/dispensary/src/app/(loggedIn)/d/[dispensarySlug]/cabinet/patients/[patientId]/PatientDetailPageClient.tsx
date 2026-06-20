'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconEdit, IconPlus, IconSettings, IconStethoscope, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DataTableEmptyState } from '@/app/_components/DataTableEmptyState/DataTableEmptyState';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import {
  deleteCabinetPatient,
  updateCabinetPatient,
} from '@/app/_actions/cabinet/patients';
import {
  deleteCareEpisode,
  listCareEpisodes,
} from '@/app/_actions/cabinet/careEpisodes';
import { handleAction } from '@/lib/action';
import {
  canOwnCabinet,
  canWriteCabinet,
  type CareEpisodeSummaryDTO,
} from '@/types/cabinet';
import type { CabinetAccessLevel } from '@prisma/client';
import type { CabinetFormSchemas, CustomValues } from '@/lib/cabinet/formSchema';
import { computeRpAge, formatRpDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { DynamicFormRenderer } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFormRenderer';
import { CabinetFormErrorBanner } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/CabinetFormErrorBanner';
import { useCabinetEntityEditing } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/hooks/useCabinetEntityEditing';
import { CareEpisodeFormModal } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/CareEpisodeFormModal';

type PatientData = {
  id: string;
  cabinetId: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  emergencyContact: string | null;
  customValues: CustomValues;
  formSchemas: CabinetFormSchemas;
  accessLevel: CabinetAccessLevel | null;
};

interface PatientDetailPageClientProps {
  dispensarySlug: string;
  patient: PatientData;
  initialEpisodes: CareEpisodeSummaryDTO[];
}

export function PatientDetailPageClient({
  dispensarySlug,
  patient: initialPatient,
  initialEpisodes,
}: PatientDetailPageClientProps) {
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [episodeModalOpen, setEpisodeModalOpen] = useState(false);

  const handleSavePatient = useCallback(
    async (patient: PatientData, customValues: CustomValues) => {
      const result = await updateCabinetPatient(dispensarySlug, {
        id: patient.id,
        cabinetId: patient.cabinetId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: patient.birthDate?.toISOString() ?? null,
        emergencyContact: patient.emergencyContact,
        customValues,
      });
      handleAction(result);
    },
    [dispensarySlug],
  );

  const {
    entity: patient,
    setEntity: setPatient,
    customValues,
    editing,
    saving,
    startEditing,
    cancelEditing,
    handleSave,
    handleCustomChange,
    handleCustomBatchChange,
    fieldErrors,
    formError,
    clearFieldError,
    entitySchema,
  } = useCabinetEntityEditing({
    entityType: 'patient',
    initialEntity: initialPatient,
    onSave: handleSavePatient,
  });

  const canWrite = canWriteCabinet(patient.accessLevel);
  const canConfigureForms = canOwnCabinet(patient.accessLevel);
  const t = tenantRoutes(dispensarySlug);

  const reloadEpisodes = useCallback(async () => {
    const result = await listCareEpisodes(dispensarySlug, patient.id);
    const data = handleAction(result);
    if (data) setEpisodes(data);
  }, [dispensarySlug, patient.id]);

  const handleDeletePatient = async () => {
    try {
      const result = await deleteCabinetPatient(dispensarySlug, patient.id);
      handleAction(result);
      window.location.href = `${t.cabinet.index}?cabinetId=${patient.cabinetId}`;
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    try {
      const result = await deleteCareEpisode(dispensarySlug, episodeId);
      handleAction(result);
      await reloadEpisodes();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  const systemCardsReadOnly = useMemo(
    () => ({
      patient_identity: (
        <Stack gap="xs">
          <Text size="sm">
            <strong>Prénom :</strong> {patient.firstName}
          </Text>
          <Text size="sm">
            <strong>Nom :</strong> {patient.lastName}
          </Text>
          <Text size="sm">
            <strong>Date de naissance :</strong> {formatRpDate(patient.birthDate)}
            {computeRpAge(patient.birthDate) !== null &&
              ` (${computeRpAge(patient.birthDate)} ans)`}
          </Text>
          <Text size="sm">
            <strong>Contact urgence :</strong> {patient.emergencyContact || '—'}
          </Text>
        </Stack>
      ),
    }),
    [patient.birthDate, patient.emergencyContact, patient.firstName, patient.lastName],
  );

  const systemCards = useMemo(
    () =>
      editing
        ? {
            patient_identity: (
              <Stack gap="md">
                <TextInput
                  label="Prénom"
                  value={patient.firstName}
                  onChange={(e) => {
                    clearFieldError('firstName');
                    setPatient((p) => ({ ...p, firstName: e.currentTarget.value }));
                  }}
                  error={fieldErrors.firstName}
                  required
                />
                <TextInput
                  label="Nom"
                  value={patient.lastName}
                  onChange={(e) => {
                    clearFieldError('lastName');
                    setPatient((p) => ({ ...p, lastName: e.currentTarget.value }));
                  }}
                  error={fieldErrors.lastName}
                  required
                />
                <RpDatePicker
                  label="Date de naissance"
                  value={patient.birthDate}
                  onChange={(d) => {
                    clearFieldError('birthDate');
                    setPatient((p) => ({ ...p, birthDate: d }));
                  }}
                  error={fieldErrors.birthDate}
                  clearable
                />
                <TextInput
                  label="Personne à contacter en cas d'urgence"
                  value={patient.emergencyContact ?? ''}
                  onChange={(e) => {
                    clearFieldError('emergencyContact');
                    setPatient((p) => ({ ...p, emergencyContact: e.currentTarget.value }));
                  }}
                  error={fieldErrors.emergencyContact}
                />
              </Stack>
            ),
          }
        : systemCardsReadOnly,
    [
      clearFieldError,
      editing,
      fieldErrors.birthDate,
      fieldErrors.emergencyContact,
      fieldErrors.firstName,
      fieldErrors.lastName,
      patient.birthDate,
      patient.emergencyContact,
      patient.firstName,
      patient.lastName,
      setPatient,
      systemCardsReadOnly,
    ],
  );

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={`${patient.lastName} ${patient.firstName}`}
        description="Fiche patient"
        backHref={`${t.cabinet.index}?cabinetId=${patient.cabinetId}`}
        backLabel="Liste des patients"
        actions={
          <Group>
            {canConfigureForms && !editing && (
              <Button
                component={Link}
                href={t.cabinet.forms(patient.cabinetId, 'patient')}
                variant="subtle"
                color="leather"
                leftSection={<IconSettings size={16} />}
              >
                Champs personnalisés
              </Button>
            )}
            {canWrite && !editing && (
              <Button color="sage" leftSection={<IconEdit size={16} />} onClick={startEditing}>
                Modifier
              </Button>
            )}
            {canWrite && editing && (
              <>
                <Button variant="subtle" color="slate" onClick={cancelEditing}>
                  Annuler
                </Button>
                <Button color="sage" loading={saving} onClick={() => void handleSave()}>
                  Enregistrer
                </Button>
              </>
            )}
            {canWrite && !editing && (
              <DeleteConfirmPopover
                title="Supprimer le patient ?"
                message={`« ${patient.lastName} ${patient.firstName} » et toutes ses données seront supprimées.`}
                onConfirm={handleDeletePatient}
              >
                <Button
                  variant="light"
                  color="danger"
                  leftSection={<IconTrash size={16} />}
                >
                  Supprimer
                </Button>
              </DeleteConfirmPopover>
            )}
          </Group>
        }
      />

      <Stack gap="xl">
        {editing && (
          <CabinetFormErrorBanner fieldErrors={fieldErrors} formError={formError} />
        )}
        <DynamicFormRenderer
          schema={entitySchema}
          values={customValues}
          onChange={handleCustomChange}
          onBatchChange={handleCustomBatchChange}
          readOnly={!editing}
          systemCards={systemCards}
          fieldErrors={editing ? fieldErrors : undefined}
        />

        <div>
          <Group justify="space-between" mb="md">
            <Title order={3} className="disp-display-title">
              Prises en charge
            </Title>
            {canWrite && (
              <Button
                color="sage"
                leftSection={<IconPlus size={16} />}
                onClick={() => setEpisodeModalOpen(true)}
              >
                Ajouter
              </Button>
            )}
          </Group>

          <DataTable
            withTableBorder
            borderRadius="sm"
            highlightOnHover
            minHeight={episodes.length === 0 ? 200 : undefined}
            records={episodes}
            columns={[
              { accessor: 'motif', title: 'Motif' },
              {
                accessor: 'startedAt',
                title: 'Début',
                render: (ep) => formatRpDate(ep.startedAt),
              },
              { accessor: 'consultationCount', title: 'Consultations' },
              {
                accessor: 'actions',
                title: '',
                textAlign: 'right',
                render: (ep) => (
                  <Group gap="xs" justify="flex-end">
                    <Button
                      component={Link}
                      href={`${t.cabinet.index}/patients/${patient.id}/episodes/${ep.id}?cabinetId=${patient.cabinetId}`}
                      variant="light"
                      color="slate"
                      size="xs"
                    >
                      Ouvrir
                    </Button>
                    {canWrite && (
                      <DeleteConfirmPopover
                        title="Supprimer la prise en charge ?"
                        message={`« ${ep.motif} » et toutes ses consultations seront supprimées.`}
                        position="left"
                        onConfirm={() => handleDeleteEpisode(ep.id)}
                      >
                        <ActionIcon variant="light" color="danger" aria-label="Supprimer la prise en charge">
                          <IconTrash size={14} />
                        </ActionIcon>
                      </DeleteConfirmPopover>
                    )}
                  </Group>
                ),
              },
            ]}
            emptyState={
              <DataTableEmptyState
                icon={IconStethoscope}
                message={
                  canWrite
                    ? 'Aucune prise en charge. Ajoutez-en une pour commencer.'
                    : 'Aucune prise en charge.'
                }
              />
            }
          />
        </div>
      </Stack>

      <CareEpisodeFormModal
        opened={episodeModalOpen}
        onClose={() => setEpisodeModalOpen(false)}
        dispensarySlug={dispensarySlug}
        patientId={patient.id}
        cabinetId={patient.cabinetId}
        onSuccess={() => void reloadEpisodes()}
      />
    </Container>
  );
}
