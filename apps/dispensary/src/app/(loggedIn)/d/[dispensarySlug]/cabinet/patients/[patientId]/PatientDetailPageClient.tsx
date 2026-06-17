'use client';

import { useCallback, useState } from 'react';
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
import { IconEdit, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
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
  canWriteCabinet,
  type CareEpisodeSummaryDTO,
} from '@/types/cabinet';
import type { CabinetAccessLevel } from '@prisma/client';
import type { CabinetFormSchemas, CustomValues } from '@/lib/cabinet/formSchema';
import { getEntitySchema } from '@/lib/cabinet/formSchema';
import { computeRpAge, formatRpDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { DynamicFormRenderer } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFormRenderer';
import { FormSchemaEditor } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/FormSchemaEditor';
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
  isAdmin: boolean;
  canEditSchema: boolean;
}

export function PatientDetailPageClient({
  dispensarySlug,
  patient: initialPatient,
  initialEpisodes,
  canEditSchema,
}: PatientDetailPageClientProps) {
  const [patient, setPatient] = useState(initialPatient);
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [editing, setEditing] = useState(false);
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false);
  const [episodeModalOpen, setEpisodeModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canWrite = canWriteCabinet(patient.accessLevel);

  const t = tenantRoutes(dispensarySlug);
  const entitySchema = getEntitySchema(patient.formSchemas, 'patient');

  const reloadEpisodes = useCallback(async () => {
    const result = await listCareEpisodes(dispensarySlug, patient.id);
    const data = handleAction(result);
    if (data) setEpisodes(data);
  }, [dispensarySlug, patient.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateCabinetPatient(dispensarySlug, {
        id: patient.id,
        cabinetId: patient.cabinetId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: patient.birthDate?.toISOString() ?? null,
        emergencyContact: patient.emergencyContact,
        customValues: patient.customValues,
      });
      handleAction(result);
      setEditing(false);
      notifications.show({ title: 'Enregistré', message: '', color: 'moss' });
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!confirm('Supprimer ce patient et toutes ses données ?')) return;
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
    if (!confirm('Supprimer cette prise en charge ?')) return;
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

  const systemCards = editing
    ? {
        patient_identity: (
          <Stack gap="md">
            <TextInput
              label="Prénom"
              value={patient.firstName}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setPatient((p) => ({ ...p, firstName: value }));
              }}
              required
            />
            <TextInput
              label="Nom"
              value={patient.lastName}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setPatient((p) => ({ ...p, lastName: value }));
              }}
              required
            />
            <RpDatePicker
              label="Date de naissance"
              value={patient.birthDate}
              onChange={(d) => setPatient((p) => ({ ...p, birthDate: d }))}
              clearable
            />
            <TextInput
              label="Personne à contacter en cas d'urgence"
              value={patient.emergencyContact ?? ''}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setPatient((p) => ({ ...p, emergencyContact: value }));
              }}
            />
          </Stack>
        ),
      }
    : {
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
      };

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={`${patient.lastName} ${patient.firstName}`}
        description="Fiche patient"
        backHref={`${t.cabinet.index}?cabinetId=${patient.cabinetId}`}
        actions={
          <Group>
            {canEditSchema && (
              <Button
                variant="light"
                color="leather"
                leftSection={<IconSettings size={16} />}
                onClick={() => setSchemaEditorOpen(true)}
              >
                Schéma
              </Button>
            )}
            {canWrite && !editing && (
              <Button
                color="sage"
                leftSection={<IconEdit size={16} />}
                onClick={() => setEditing(true)}
              >
                Modifier
              </Button>
            )}
            {canWrite && editing && (
              <>
                <Button variant="subtle" color="slate" onClick={() => setEditing(false)}>
                  Annuler
                </Button>
                <Button color="sage" loading={saving} onClick={() => void handleSave()}>
                  Enregistrer
                </Button>
              </>
            )}
            {canWrite && (
              <ActionIcon variant="light" color="danger" onClick={() => void handleDeletePatient()}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        }
      />

      <Stack gap="xl">
        <DynamicFormRenderer
          schema={entitySchema}
          values={patient.customValues}
          onChange={(fieldId, value) =>
            setPatient((p) => ({
              ...p,
              customValues: { ...p.customValues, [fieldId]: value },
            }))
          }
          readOnly={!editing}
          systemCards={systemCards}
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
                      <ActionIcon
                        variant="light"
                        color="danger"
                        onClick={() => void handleDeleteEpisode(ep.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                ),
              },
            ]}
            emptyState={<Text c="dimmed" py="md">Aucune prise en charge</Text>}
          />
        </div>
      </Stack>

      <FormSchemaEditor
        opened={schemaEditorOpen}
        onClose={() => setSchemaEditorOpen(false)}
        dispensarySlug={dispensarySlug}
        cabinetId={patient.cabinetId}
        entityType="patient"
        initialSchemas={patient.formSchemas}
        onSchemasChange={(schemas) => setPatient((p) => ({ ...p, formSchemas: schemas }))}
      />

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
