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
import { FormSchemaEditor } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/FormSchemaEditor';

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
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canWrite = canWriteCabinet(consultation.accessLevel);
  const t = tenantRoutes(dispensarySlug);
  const entitySchema = getEntitySchema(consultation.formSchemas, 'consultation');
  const { careEpisode } = consultation;

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
    : {
        consultation_general: (
          <Text size="sm">
            <strong>Date :</strong> {formatRpDate(consultation.date)}
          </Text>
        ),
      };

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={`Consultation — ${formatRpDate(consultation.date)}`}
        description={`${careEpisode.motif} — ${careEpisode.patient.lastName} ${careEpisode.patient.firstName}`}
        backHref={`${t.cabinet.index}/patients/${careEpisode.patientId}/episodes/${careEpisode.id}?cabinetId=${careEpisode.patient.cabinetId}`}
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
          systemCards={systemCards}
        />
      </Stack>

      <FormSchemaEditor
        opened={schemaEditorOpen}
        onClose={() => setSchemaEditorOpen(false)}
        dispensarySlug={dispensarySlug}
        cabinetId={careEpisode.patient.cabinetId}
        entityType="consultation"
        initialSchemas={consultation.formSchemas}
        onSchemasChange={(schemas) =>
          setConsultation((c) => ({ ...c, formSchemas: schemas }))
        }
      />
    </Container>
  );
}
