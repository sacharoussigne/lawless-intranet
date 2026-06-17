'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { IconEdit, IconSettings, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import {
  deleteConsultation,
  updateConsultation,
} from '@/app/_actions/cabinet/consultations';
import { handleAction } from '@/lib/action';
import { canWriteCabinet } from '@/types/cabinet';
import type { CabinetAccessLevel } from '@prisma/client';
import type { CabinetFormSchemas, CustomValues } from '@/lib/cabinet/formSchema';
import { getEntitySchema } from '@/lib/cabinet/formSchema';
import { formatRpDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { DynamicFormRenderer } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFormRenderer';
import { useCabinetSchemaEditing } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/hooks/useCabinetSchemaEditing';

type ConsultationData = {
  id: string;
  careEpisodeId: string;
  date: Date;
  customValues: CustomValues;
  formSchemas: CabinetFormSchemas;
  accessLevel: CabinetAccessLevel | null;
  careEpisode: {
    id: string;
    motif: string;
    patientId: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      cabinetId: string;
    };
  };
};

interface ConsultationDetailPageClientProps {
  dispensarySlug: string;
  consultation: ConsultationData;
  canEditSchema: boolean;
}

export function ConsultationDetailPageClient({
  dispensarySlug,
  consultation: initialConsultation,
  canEditSchema,
}: ConsultationDetailPageClientProps) {
  const [consultation, setConsultation] = useState(initialConsultation);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { careEpisode } = consultation;

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
    cabinetId: careEpisode.patient.cabinetId,
    entityType: 'consultation',
    formSchemas: consultation.formSchemas,
    onSchemasSaved: (schemas) => setConsultation((c) => ({ ...c, formSchemas: schemas })),
  });

  const canWrite = canWriteCabinet(consultation.accessLevel);
  const t = tenantRoutes(dispensarySlug);
  const entitySchema = schemaEditing
    ? draftEntitySchema
    : getEntitySchema(consultation.formSchemas, 'consultation');

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateConsultation(dispensarySlug, {
        id: consultation.id,
        careEpisodeId: consultation.careEpisodeId,
        date: consultation.date.toISOString(),
        customValues: consultation.customValues,
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

  const handleDelete = async () => {
    if (!confirm('Supprimer cette consultation ?')) return;
    try {
      const result = await deleteConsultation(dispensarySlug, consultation.id);
      handleAction(result);
      window.location.href = `${t.cabinet.index}/patients/${careEpisode.patientId}/episodes/${careEpisode.id}?cabinetId=${careEpisode.patient.cabinetId}`;
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  const systemCardsReadOnly = {
    consultation_general: (
      <Text size="sm">
        <strong>Date :</strong> {formatRpDate(consultation.date)}
      </Text>
    ),
  };

  const systemCards = editing
    ? {
        consultation_general: (
          <RpDatePicker
            label="Date"
            value={consultation.date}
            onChange={(d) =>
              setConsultation((c) => ({ ...c, date: d ?? c.date }))
            }
            required
          />
        ),
      }
    : systemCardsReadOnly;

  const activeSystemCards = schemaEditing ? systemCardsReadOnly : systemCards;

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={`Consultation — ${formatRpDate(consultation.date)}`}
        description={`${careEpisode.motif} — ${careEpisode.patient.lastName} ${careEpisode.patient.firstName}`}
        backHref={`${t.cabinet.index}/patients/${careEpisode.patientId}/episodes/${careEpisode.id}?cabinetId=${careEpisode.patient.cabinetId}`}
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
              <ActionIcon variant="light" color="danger" onClick={() => void handleDelete()}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        }
      />

      <Stack gap="xl">
        <DynamicFormRenderer
          schema={entitySchema}
          values={consultation.customValues}
          onChange={(fieldId, value) =>
            setConsultation((c) => ({
              ...c,
              customValues: { ...c.customValues, [fieldId]: value },
            }))
          }
          readOnly={!editing}
          systemCards={activeSystemCards}
          mode={schemaEditing ? 'schema' : 'values'}
          onSchemaChange={setDraftEntitySchema}
        />
      </Stack>
    </Container>
  );
}
