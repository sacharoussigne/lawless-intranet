'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { IconEdit, IconCalendar, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DataTableEmptyState } from '@/app/_components/DataTableEmptyState/DataTableEmptyState';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import {
  createConsultation,
  deleteConsultation,
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
import { formatRpDate, getTodayRealDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { DynamicFormRenderer } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFormRenderer';
import { CabinetFormErrorBanner } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/CabinetFormErrorBanner';
import { useCabinetEntityEditing } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/hooks/useCabinetEntityEditing';

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
  const [consultations, setConsultations] = useState(initialConsultations);
  const [newConsultationDate, setNewConsultationDate] = useState<Date | null>(
    () => getTodayRealDate(),
  );

  const handleSaveEpisode = useCallback(
    async (episode: EpisodeData, customValues: CustomValues) => {
      const result = await updateCareEpisode(dispensarySlug, {
        id: episode.id,
        patientId: episode.patientId,
        motif: episode.motif,
        startedAt: episode.startedAt.toISOString(),
        customValues,
      });
      handleAction(result);
    },
    [dispensarySlug],
  );

  const {
    entity: episode,
    setEntity: setEpisode,
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
    schemaEditing,
    savingSchema,
    startSchemaEditing,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema,
    entitySchema,
  } = useCabinetEntityEditing({
    dispensarySlug,
    cabinetId: initialEpisode.patient.cabinetId,
    entityType: 'careEpisode',
    initialEntity: initialEpisode,
    canEditSchema,
    onSave: handleSaveEpisode,
  });

  const canWrite = canWriteCabinet(episode.accessLevel);
  const t = tenantRoutes(dispensarySlug);

  const reloadConsultations = useCallback(async () => {
    const result = await listConsultations(dispensarySlug, episode.id);
    const data = handleAction(result);
    if (data) setConsultations(data);
  }, [dispensarySlug, episode.id]);

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

  const handleDeleteConsultation = async (consultationId: string) => {
    try {
      const result = await deleteConsultation(dispensarySlug, consultationId);
      handleAction(result);
      notifications.show({ title: 'Consultation supprimée', message: '', color: 'moss' });
      await reloadConsultations();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec de la suppression',
        color: 'danger',
      });
    }
  };

  const handleDeleteEpisode = async () => {
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

  const systemCardsReadOnly = useMemo(
    () => ({
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
    }),
    [episode.motif, episode.startedAt],
  );

  const systemCards = useMemo(
    () =>
      editing
        ? {
            care_episode_general: (
              <Stack gap="md">
                <TextInput
                  label="Motif"
                  value={episode.motif}
                  onChange={(e) => {
                    clearFieldError('motif');
                    setEpisode((ep) => ({ ...ep, motif: e.currentTarget.value }));
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
        : systemCardsReadOnly,
    [
      clearFieldError,
      editing,
      episode.motif,
      episode.startedAt,
      fieldErrors.motif,
      fieldErrors.startedAt,
      setEpisode,
      systemCardsReadOnly,
    ],
  );

  const activeSystemCards = schemaEditing ? systemCardsReadOnly : systemCards;

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Prise en charge"
        description={`${episode.patient.firstName} ${episode.patient.lastName} — ${episode.motif}`}
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
            {canWrite && !editing && !schemaEditing && (
              <DeleteConfirmPopover
                title="Supprimer la prise en charge ?"
                message={`« ${episode.motif} » et toutes ses consultations seront supprimées.`}
                onConfirm={handleDeleteEpisode}
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
            minHeight={200}
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
                  <Group gap="xs" justify="flex-end">
                    <Button
                      component={Link}
                      href={`${t.cabinet.index}/patients/${episode.patientId}/episodes/${episode.id}/consultations/${c.id}?cabinetId=${episode.patient.cabinetId}`}
                      variant="light"
                      color="slate"
                      size="xs"
                    >
                      Ouvrir
                    </Button>
                    {canWrite && (
                      <DeleteConfirmPopover
                        title="Supprimer la consultation ?"
                        message={`La consultation du ${formatRpDate(c.date)} sera supprimée.`}
                        position="left"
                        onConfirm={() => handleDeleteConsultation(c.id)}
                      >
                        <ActionIcon variant="light" color="danger" aria-label="Supprimer la consultation">
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
                icon={IconCalendar}
                message={
                  canWrite
                    ? 'Aucune consultation. Ajoutez-en une pour commencer.'
                    : 'Aucune consultation.'
                }
              />
            }
          />
        </div>
        )}
      </Stack>
    </Container>
  );
}
