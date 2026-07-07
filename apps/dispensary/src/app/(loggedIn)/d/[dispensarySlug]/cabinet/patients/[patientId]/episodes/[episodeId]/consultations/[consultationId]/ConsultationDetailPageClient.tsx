'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { IconCheck, IconCopy, IconEdit, IconEye, IconFileText, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import {
  deleteConsultation,
  updateConsultation,
} from '@/app/_actions/cabinet/consultations';
import {
  createConsultationDocumentFromTemplate,
  createFreeTextConsultationDocument,
  deleteConsultationDocument,
  updateConsultationDocument,
} from '@/app/_actions/cabinet/consultationDocuments';
import { handleAction } from '@/lib/action';
import { canWriteCabinet } from '@/types/cabinet';
import type { CabinetAccessLevel } from '@prisma/client';
import type { CabinetFormSchemas, CustomValues } from '@/lib/cabinet/formSchema';
import type { CabinetDisplaySettings } from '@/lib/cabinet/displaySettings';
import { getMantineLabelStyles } from '@/lib/cabinet/displaySettings';
import { formatRpDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { DynamicFormRenderer } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFormRenderer';
import { CabinetFormErrorBanner } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/CabinetFormErrorBanner';
import { useCabinetEntityEditing } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/hooks/useCabinetEntityEditing';
import {
  buildConsultationTemplateVariables,
} from '@/lib/cabinet/documents';
import type {
  ConsultationDocumentListItem,
  ConsultationDocumentTemplateListItem,
} from '@/types/cabinetDocuments';
import { ConsultationDocumentModal } from './ConsultationDocumentModal';
import { CabinetDisplaySettingsProvider } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/CabinetDisplaySettingsContext';
import { SystemFieldValue } from '@/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/CabinetFieldLabel';

type ConsultationData = {
  id: string;
  careEpisodeId: string;
  date: Date;
  customValues: CustomValues;
  formSchemas: CabinetFormSchemas;
  displaySettings: CabinetDisplaySettings;
  accessLevel: CabinetAccessLevel | null;
  careEpisode: {
    id: string;
    motif: string;
    patientId: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      birthDate: Date | null;
      cabinetId: string;
      customValues: CustomValues;
      cabinet: {
        name: string;
      };
    };
    startedAt: Date;
    customValues: CustomValues;
  };
};

interface ConsultationDetailPageClientProps {
  dispensarySlug: string;
  consultation: ConsultationData;
  initialDocuments: ConsultationDocumentListItem[];
  availableTemplates: ConsultationDocumentTemplateListItem[];
}

export function ConsultationDetailPageClient({
  dispensarySlug,
  consultation: initialConsultation,
  initialDocuments,
  availableTemplates,
}: ConsultationDetailPageClientProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<ConsultationDocumentListItem | null>(null);
  const [viewingDocument, setViewingDocument] = useState<ConsultationDocumentListItem | null>(null);
  const [copiedDocument, setCopiedDocument] = useState(false);

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
    entitySchema,
  } = useCabinetEntityEditing({
    entityType: 'consultation',
    initialEntity: initialConsultation,
    onSave: handleSaveConsultation,
  });

  const { careEpisode } = consultation;
  const canWrite = canWriteCabinet(consultation.accessLevel);
  const t = tenantRoutes(dispensarySlug);
  const templateVariables = useMemo(
    () =>
      buildConsultationTemplateVariables({
        cabinetName: consultation.careEpisode.patient.cabinet.name,
        patient: {
          firstName: consultation.careEpisode.patient.firstName,
          lastName: consultation.careEpisode.patient.lastName,
          birthDate: consultation.careEpisode.patient.birthDate,
          customValues: consultation.careEpisode.patient.customValues,
        },
        careEpisode: {
          motif: consultation.careEpisode.motif,
          startedAt: consultation.careEpisode.startedAt,
          customValues: consultation.careEpisode.customValues,
        },
        consultation: {
          date: consultation.date,
          customValues,
        },
      }),
    [consultation.careEpisode, consultation.date, customValues],
  );

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

  const systemLabelStyles = useMemo(
    () => getMantineLabelStyles('system', consultation.displaySettings),
    [consultation.displaySettings],
  );

  const systemCardsReadOnly = useMemo(
    () => ({
      consultation_general: (
        <SystemFieldValue label="Date" value={formatRpDate(consultation.date)} />
      ),
    }),
    [consultation.date],
  );

  const openCreateDocumentModal = () => {
    setEditingDocument(null);
    setDocumentModalOpen(true);
  };

  const openEditDocumentModal = (document: ConsultationDocumentListItem) => {
    setEditingDocument(document);
    setDocumentModalOpen(true);
  };

  const handleCreateFreeTextDocument = async (values: {
    name: string;
    content: string;
  }) => {
    const result = await createFreeTextConsultationDocument(dispensarySlug, {
      consultationId: consultation.id,
      ...values,
    });
    const created = handleAction(result);
    if (created) {
      setDocuments((current) => [created, ...current]);
      notifications.show({
        title: 'Document créé',
        message: '',
        color: 'moss',
      });
    }
  };

  const handleCreateDocumentFromTemplate = async (values: {
    templateId: string;
    name: string;
    content: string;
  }) => {
    const result = await createConsultationDocumentFromTemplate(dispensarySlug, {
      consultationId: consultation.id,
      ...values,
    });
    const created = handleAction(result);
    if (created) {
      setDocuments((current) => [created, ...current]);
      notifications.show({
        title: 'Document créé',
        message: '',
        color: 'moss',
      });
    }
  };

  const handleUpdateDocument = async (values: {
    id: string;
    name: string;
    content: string;
  }) => {
    const result = await updateConsultationDocument(dispensarySlug, {
      consultationId: consultation.id,
      ...values,
    });
    const updated = handleAction(result);
    if (updated) {
      setDocuments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notifications.show({
        title: 'Document mis à jour',
        message: '',
        color: 'moss',
      });
    }
  };

  const handleCopyDocument = async () => {
    if (!viewingDocument?.content) return;

    try {
      await navigator.clipboard.writeText(viewingDocument.content);
      setCopiedDocument(true);
      notifications.show({
        title: 'Succès',
        message: 'Document copié dans le presse-papiers',
        color: 'moss',
      });
      setTimeout(() => setCopiedDocument(false), 2000);
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de copier le document',
        color: 'danger',
      });
    }
  };

  const handleDeleteDocument = async (document: ConsultationDocumentListItem) => {
    try {
      const result = await deleteConsultationDocument(dispensarySlug, {
        id: document.id,
        consultationId: consultation.id,
      });
      handleAction(result);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      notifications.show({
        title: 'Document supprimé',
        message: '',
        color: 'moss',
      });
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec de la suppression',
        color: 'danger',
      });
    }
  };

  const systemCards = useMemo(
    () =>
      editing
        ? {
            consultation_general: (
              <RpDatePicker
                label="Date"
                value={consultation.date}
                styles={systemLabelStyles}
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
      systemLabelStyles,
    ],
  );

  return (
    <CabinetDisplaySettingsProvider settings={consultation.displaySettings}>
    <Container size="xl" py="xl">
      <PageHeader
        title={`Consultation — ${formatRpDate(consultation.date)}`}
        description={`${careEpisode.patient.firstName} ${careEpisode.patient.lastName} — ${careEpisode.motif}`}
        backHref={`${t.cabinet.index}/patients/${careEpisode.patientId}/episodes/${careEpisode.id}?cabinetId=${careEpisode.patient.cabinetId}`}
        backLabel={`Prise en charge : ${careEpisode.motif}`}
        actions={
          <Group>
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
        <Paper withBorder p="lg" radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text fw={600}>Documents</Text>
                <Text size="sm" c="dimmed">
                  Documents rattachés à cette consultation.
                </Text>
              </div>
              {canWrite && (
                <Button
                  color="sage"
                  leftSection={<IconPlus size={16} />}
                  onClick={openCreateDocumentModal}
                >
                  Nouveau document
                </Button>
              )}
            </Group>

            {documents.length > 0 && (
              <Stack gap="sm">
                {documents.map((document) => (
                  <Paper key={document.id} withBorder p="md" radius="md">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <div>
                        <Group gap="xs">
                          <IconFileText size={16} />
                          <Text fw={500}>{document.name}</Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {document.source === 'template' ? 'Depuis un template' : 'Texte libre'} ·{' '}
                          {formatRpDate(document.createdAt)}
                        </Text>
                      </div>
                      <Group gap="xs" wrap="nowrap">
                        <ActionIcon 
                          variant="light"
                          color="slate"
                          aria-label={`Voir ${document.name}`}
                          onClick={() => setViewingDocument(document)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                        {canWrite && (
                          <>
                            <ActionIcon
                              variant="light"
                              color="slate"
                              aria-label={`Modifier ${document.name}`}
                              onClick={() => openEditDocumentModal(document)}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                            <DeleteConfirmPopover
                              title="Supprimer le document ?"
                              message={`Le document « ${document.name} » sera supprimé.`}
                              onConfirm={() => handleDeleteDocument(document)}
                            >
                              <ActionIcon
                                variant="light"
                                color="danger"
                                aria-label={`Supprimer ${document.name}`}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </DeleteConfirmPopover>
                          </>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>

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
      </Stack>

      <Modal
        opened={viewingDocument !== null}
        onClose={() => {
          setViewingDocument(null);
          setCopiedDocument(false);
        }}
        title={viewingDocument?.name ?? 'Document'}
        size="lg"
      >
        {viewingDocument && (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                {viewingDocument.source === 'template' ? 'Depuis un template' : 'Texte libre'} ·{' '}
                {formatRpDate(viewingDocument.createdAt)}
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={copiedDocument ? <IconCheck size={16} /> : <IconCopy size={16} />}
                onClick={handleCopyDocument}
                color={copiedDocument ? 'moss' : 'sage'}
              >
                {copiedDocument ? 'Copié !' : 'Copier'}
              </Button>
            </Group>
            <Textarea
              value={viewingDocument.content}
              readOnly
              minRows={16}
              autosize
              styles={{
                input: {
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                },
              }}
            />
          </Stack>
        )}
      </Modal>

      {documentModalOpen && (
        <ConsultationDocumentModal
          key={editingDocument?.id ?? 'create'}
          opened
          onClose={() => {
            setDocumentModalOpen(false);
            setEditingDocument(null);
          }}
          mode={editingDocument ? 'edit' : 'create'}
          document={editingDocument}
          templates={availableTemplates}
          variables={templateVariables}
          onCreateFreeText={handleCreateFreeTextDocument}
          onCreateFromTemplate={handleCreateDocumentFromTemplate}
          onUpdate={handleUpdateDocument}
        />
      )}
    </Container>
    </CabinetDisplaySettingsProvider>
  );
}
