'use client';

import { useCallback, useMemo } from 'react';
import {
  Button,
  Container,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { IconEdit, IconSettings, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import {
  deleteConsultation,
  updateConsultation,
} from '@/app/_actions/cabinet/consultations';
import { handleAction } from '@/lib/action';
import { canWriteCabinet } from '@/types/cabinet';
import type { CabinetAccessLevel } from '@prisma/client';
import type { CabinetFormSchemas, CustomValues } from '@/lib/cabinet/formSchema';
import { formatRpDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { DynamicFormRenderer } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFormRenderer';
import { CabinetFormErrorBanner } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/CabinetFormErrorBanner';
import { useCabinetEntityEditing } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/hooks/useCabinetEntityEditing';

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
  const handleSaveConsultation = useCallback(
    async (consultation: ConsultationData, customValues: CustomValues) => {
      const result = await updateConsultation(dispensarySlug, {
        id: consultation.id,
        careEpisodeId: consultation.careEpisodeId,
        date: consultation.date.toISOString(),
        customValues,
      });
      handleAction(result);
    },
    [dispensarySlug],
  );

  const {
    entity: consultation,
    setEntity: setConsultation,
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
    cabinetId: initialConsultation.careEpisode.patient.cabinetId,
    entityType: 'consultation',
    initialEntity: initialConsultation,
    canEditSchema,
    onSave: handleSaveConsultation,
  });

  const { careEpisode } = consultation;
  const canWrite = canWriteCabinet(consultation.accessLevel);
  const t = tenantRoutes(dispensarySlug);

  const handleDelete = async () => {
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

  const systemCardsReadOnly = useMemo(
    () => ({
      consultation_general: (
        <Text size="sm">
          <strong>Date :</strong> {formatRpDate(consultation.date)}
        </Text>
      ),
    }),
    [consultation.date],
  );

  const systemCards = useMemo(
    () =>
      editing
        ? {
            consultation_general: (
              <RpDatePicker
                label="Date"
                value={consultation.date}
                onChange={(d) => {
                  clearFieldError('date');
                  setConsultation((c) => ({ ...c, date: d ?? c.date }));
                }}
                error={fieldErrors.date}
                required
              />
            ),
          }
        : systemCardsReadOnly,
    [
      clearFieldError,
      consultation.date,
      editing,
      fieldErrors.date,
      setConsultation,
      systemCardsReadOnly,
    ],
  );

  const activeSystemCards = schemaEditing ? systemCardsReadOnly : systemCards;

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={`Consultation — ${formatRpDate(consultation.date)}`}
        description={`${careEpisode.patient.firstName} ${careEpisode.patient.lastName} — ${careEpisode.motif}`}
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
                title="Supprimer la consultation ?"
                message={`La consultation du ${formatRpDate(consultation.date)} sera supprimée.`}
                onConfirm={handleDelete}
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
      </Stack>
    </Container>
  );
}
