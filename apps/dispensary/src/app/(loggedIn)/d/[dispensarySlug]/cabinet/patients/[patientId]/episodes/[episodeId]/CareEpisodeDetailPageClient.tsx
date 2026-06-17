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
import { formatRpDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { DynamicFormRenderer } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFormRenderer';
import { FormSchemaEditor } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/FormSchemaEditor';

type EpisodeData = {
  id: string;
  patientId: string;
  motif: string;
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
  const [episode, setEpisode] = useState(initialEpisode);
  const [consultations, setConsultations] = useState(initialConsultations);
  const [editing, setEditing] = useState(false);
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newConsultationDate, setNewConsultationDate] = useState<Date | null>(new Date());

  const canWrite = canWriteCabinet(episode.accessLevel);
  const t = tenantRoutes(dispensarySlug);
  const entitySchema = getEntitySchema(episode.formSchemas, 'careEpisode');

  const reloadConsultations = useCallback(async () => {
    const result = await listConsultations(dispensarySlug, episode.id);
    const data = handleAction(result);
    if (data) setConsultations(data);
  }, [dispensarySlug, episode.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateCareEpisode(dispensarySlug, {
        id: episode.id,
        patientId: episode.patientId,
        motif: episode.motif,
        customValues: episode.customValues,
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

  const handleAddConsultation = async () => {
    if (!newConsultationDate) return;
    try {
      const result = await createConsultation(dispensarySlug, {
        careEpisodeId: episode.id,
        date: newConsultationDate.toISOString(),
      });
      handleAction(result);
      await reloadConsultations();
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

  const systemCards = editing
    ? {
        care_episode_general: (
          <TextInput
            label="Motif"
            value={episode.motif}
            onChange={(e) => setEpisode((ep) => ({ ...ep, motif: e.currentTarget.value }))}
            required
          />
        ),
      }
    : {
        care_episode_general: (
          <Text size="sm">
            <strong>Motif :</strong> {episode.motif}
          </Text>
        ),
      };

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={episode.motif}
        description={`${episode.patient.lastName} ${episode.patient.firstName} — Prise en charge`}
        backHref={`${t.cabinet.index}/patients/${episode.patientId}?cabinetId=${episode.patient.cabinetId}`}
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
              <Button color="sage" leftSection={<IconEdit size={16} />} onClick={() => setEditing(true)}>
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
              <ActionIcon variant="light" color="danger" onClick={() => void handleDeleteEpisode()}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        }
      />

      <Stack gap="xl">
        <DynamicFormRenderer
          schema={entitySchema}
          values={episode.customValues}
          onChange={(fieldId, value) =>
            setEpisode((ep) => ({
              ...ep,
              customValues: { ...ep.customValues, [fieldId]: value },
            }))
          }
          readOnly={!editing}
          systemCards={systemCards}
        />

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
      </Stack>

      <FormSchemaEditor
        opened={schemaEditorOpen}
        onClose={() => setSchemaEditorOpen(false)}
        dispensarySlug={dispensarySlug}
        cabinetId={episode.patient.cabinetId}
        entityType="careEpisode"
        initialSchemas={episode.formSchemas}
        onSchemasChange={(schemas) => setEpisode((ep) => ({ ...ep, formSchemas: schemas }))}
      />
    </Container>
  );
}
