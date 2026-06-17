'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  createConsultation,
  listConsultations,
} from '@/app/_actions/cabinet/consultations';
import {
  updateCareEpisode,
  deleteCareEpisode,
} from '@/app/_actions/cabinet/careEpisodes';
import { handleAction } from '@/lib/action';
import { canWriteCabinet, type ConsultationSummaryDTO } from '@/types/cabinet';
import type { CabinetAccessLevel } from '@prisma/client';
import type { CabinetFormSchemas, CustomValues } from '@/lib/cabinet/formSchema';
import { getEntitySchema } from '@/lib/cabinet/formSchema';
import { formatRpDate, getTodayRealDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { DynamicFormRenderer } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFormRenderer';
import { CabinetFormErrorBanner } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/CabinetFormErrorBanner';
import { useCabinetSchemaEditing } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/hooks/useCabinetSchemaEditing';
import { useCabinetFieldErrors } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/hooks/useCabinetFieldErrors';

type EpisodeData = {
  id: string;
  patientId: string;
  motif: string;
  startedAt: Date;
  customValues: CustomValues;
  formSchemas: CabinetFormSchemas;
  accessLevel: CabinetAccessLevel | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    cabinetId: string;
  };
};

interface CareEpisodeDetailPageClientProps {
  dispensarySlug: string;
  episode: EpisodeData;
  initialConsultations: ConsultationSummaryDTO[];
  canEditSchema: boolean;
}

export function CareEpisodeDetailPageClient({
  dispensarySlug,
  episode: initialEpisode,
  initialConsultations,
  canEditSchema,
}: CareEpisodeDetailPageClientProps) {
  const router = useRouter();
  const [episode, setEpisode] = useState(initialEpisode);
  const [consultations, setConsultations] = useState(initialConsultations);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newConsultationDate, setNewConsultationDate] = useState<Date | null>(
    () => getTodayRealDate(),
  );
  const { fieldErrors, formError, clearFieldError, resetErrors, applySubmitError } =
    useCabinetFieldErrors();

  const {
    schemaEditing,
    draftEntitySchema,
    savingSchema,
    startSchemaEditing,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema,
  } = useCabinetSchemaEditing({
    dispensarySlug,
    cabinetId: episode.patient.cabinetId,
    entityType: 'careEpisode',
    formSchemas: episode.formSchemas,
    onSchemasSaved: (schemas) => setEpisode((ep) => ({ ...ep, formSchemas: schemas })),
  });

  const canWrite = canWriteCabinet(episode.accessLevel);
  const t = tenantRoutes(dispensarySlug);
  const entitySchema = schemaEditing
    ? draftEntitySchema
    : getEntitySchema(episode.formSchemas, 'careEpisode');

  const reloadConsultations = useCallback(async () => {
    const result = await listConsultations(dispensarySlug, episode.id);
    const data = handleAction(result);
    if (data) setConsultations(data);
  }, [dispensarySlug, episode.id]);

  const handleSave = async () => {
    setSaving(true);
    resetErrors();
    try {
      const result = await updateCareEpisode(dispensarySlug, {
        id: episode.id,
        patientId: episode.patientId,
        motif: episode.motif,
        startedAt: episode.startedAt.toISOString(),
        customValues: episode.customValues,
      });
      handleAction(result);
      setEditing(false);
      notifications.show({ title: 'Enregistré', message: '', color: 'moss' });
    } catch (error: unknown) {
      applySubmitError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddConsultation = async () => {
    if (!newConsultationDate) return;
    try {
      const result = await createConsultation(dispensarySlug, {
        careEpisodeId: episode.id,
        date: newConsultationDate.toISOString(),
      });
      const created = handleAction(result);
      notifications.show({ title: 'Consultation créée', message: '', color: 'moss' });
      if (created?.id) {
        router.push(
          `${t.cabinet.index}/patients/${episode.patientId}/episodes/${episode.id}/consultations/${created.id}?cabinetId=${episode.patient.cabinetId}`,
        );
      } else {
        await reloadConsultations();
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  const handleDeleteEpisode = async () => {
    if (!confirm('Supprimer cette prise en charge ?')) return;
    try {
      const result = await deleteCareEpisode(dispensarySlug, episode.id);
      handleAction(result);
      window.location.href = `${t.cabinet.index}/patients/${episode.patientId}?cabinetId=${episode.patient.cabinetId}`;
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  const systemCardsReadOnly = {
    care_episode_general: (
      <Stack gap="xs">
        <Text size="sm">
          <strong>Motif :</strong> {episode.motif}
        </Text>
        <Text size="sm">
          <strong>Date de début :</strong> {formatRpDate(episode.startedAt)}
        </Text>
      </Stack>
    ),
  };

  const systemCards = editing
    ? {
        care_episode_general: (
          <Stack gap="md">
            <TextInput
              label="Motif"
              value={episode.motif}
              onChange={(e) => {
                clearFieldError('motif');
                const value = e.currentTarget.value;
                setEpisode((ep) => ({ ...ep, motif: value }));
              }}
              error={fieldErrors.motif}
              required
            />
            <RpDatePicker
              label="Date de début"
              value={episode.startedAt}
              onChange={(d) => {
                clearFieldError('startedAt');
                if (d) setEpisode((ep) => ({ ...ep, startedAt: d }));
              }}
              error={fieldErrors.startedAt}
              required
            />
          </Stack>
        ),
      }
    : systemCardsReadOnly;

  const activeSystemCards = schemaEditing ? systemCardsReadOnly : systemCards;

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={episode.motif}
        description={`${episode.patient.lastName} ${episode.patient.firstName} — Prise en charge`}
        backHref={`${t.cabinet.index}/patients/${episode.patientId}?cabinetId=${episode.patient.cabinetId}`}
        actions={
          <Group>
            {canEditSchema && !schemaEditing && (
              <Button
                variant="light"
                color="leather"
                leftSection={<IconSettings size={16} />}
                onClick={startSchemaEditing}
              >
                Configurer le formulaire
              </Button>
            )}
            {canEditSchema && schemaEditing && (
              <>
                <Button variant="subtle" color="slate" onClick={cancelSchemaEditing}>
                  Annuler
                </Button>
                <Button
                  color="sage"
                  loading={savingSchema}
                  onClick={() => void saveSchemaEditing()}
                >
                  Enregistrer le schéma
                </Button>
              </>
            )}
            {canWrite && !editing && !schemaEditing && (
              <Button
                color="sage"
                leftSection={<IconEdit size={16} />}
                onClick={() => {
                  resetErrors();
                  setEditing(true);
                }}
              >
                Modifier
              </Button>
            )}
            {canWrite && editing && (
              <>
                <Button
                  variant="subtle"
                  color="slate"
                  onClick={() => {
                    resetErrors();
                    setEditing(false);
                  }}
                >
                  Annuler
                </Button>
                <Button color="sage" loading={saving} onClick={() => void handleSave()}>
                  Enregistrer
                </Button>
              </>
            )}
            {canWrite && (
              <ActionIcon variant="light" color="danger" onClick={() => void handleDeleteEpisode()}>
                <IconTrash size={16} />
              </ActionIcon>
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
          values={episode.customValues}
          onChange={(fieldId, value) => {
            clearFieldError(fieldId);
            setEpisode((ep) => ({
              ...ep,
              customValues: { ...ep.customValues, [fieldId]: value },
            }));
          }}
          readOnly={!editing}
          systemCards={activeSystemCards}
          mode={schemaEditing ? 'schema' : 'values'}
          onSchemaChange={setDraftEntitySchema}
          fieldErrors={editing ? fieldErrors : undefined}
        />

        {!schemaEditing && (
        <div>
          <Title order={3} className="disp-display-title" mb="md">
            Consultations
          </Title>

          {canWrite && (
            <Group mb="md" align="flex-end">
              <RpDatePicker
                label="Nouvelle consultation"
                value={newConsultationDate}
                onChange={setNewConsultationDate}
                style={{ flex: 1 }}
              />
              <Button color="sage" leftSection={<IconPlus size={16} />} onClick={() => void handleAddConsultation()}>
                Ajouter
              </Button>
            </Group>
          )}

          <DataTable
            withTableBorder
            borderRadius="sm"
            highlightOnHover
            records={consultations}
            columns={[
              {
                accessor: 'date',
                title: 'Date',
                render: (c) => formatRpDate(c.date),
              },
              {
                accessor: 'actions',
                title: '',
                textAlign: 'right',
                render: (c) => (
                  <Button
                    component={Link}
                    href={`${t.cabinet.index}/patients/${episode.patientId}/episodes/${episode.id}/consultations/${c.id}?cabinetId=${episode.patient.cabinetId}`}
                    variant="light"
                    color="slate"
                    size="xs"
                  >
                    Ouvrir
                  </Button>
                ),
              },
            ]}
            emptyState={<Text c="dimmed" py="md">Aucune consultation</Text>}
          />
        </div>
        )}
      </Stack>
    </Container>
  );
}
