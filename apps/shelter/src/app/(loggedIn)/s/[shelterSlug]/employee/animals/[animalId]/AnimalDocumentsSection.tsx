'use client';

import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconEye,
  IconFileText,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import {
  createAnimalDocumentFromTemplate,
  createFreeTextAnimalDocument,
  deleteAnimalDocument,
  getAnimalDocument,
  updateAnimalDocument,
} from '@/app/_actions/animalDocuments';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { handleAction } from '@/lib/action';
import { buildAnimalTemplateVariables } from '@/lib/animals/documents';
import { formatRpDate } from '@/lib/rpCalendar';
import type {
  AnimalDocumentListItem,
  AnimalDocumentTemplateListItem,
} from '@/types/animalDocuments';
import { parseIsoDateOnly, type AnimalDTO } from '../types';
import { AnimalDocumentModal } from './AnimalDocumentModal';

type AnimalDocumentsSectionProps = {
  shelterSlug: string;
  shelterName: string;
  animal: AnimalDTO;
  initialDocuments: AnimalDocumentListItem[];
  availableTemplates: AnimalDocumentTemplateListItem[];
  canUpdate: boolean;
};

export function AnimalDocumentsSection({
  shelterSlug,
  shelterName,
  animal,
  initialDocuments,
  availableTemplates,
  canUpdate,
}: AnimalDocumentsSectionProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<AnimalDocumentListItem | null>(null);
  const [viewingDocument, setViewingDocument] = useState<AnimalDocumentListItem | null>(null);
  const [copiedDocument, setCopiedDocument] = useState(false);
  const [copiedDocumentId, setCopiedDocumentId] = useState<string | null>(null);
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);

  const templateVariables = useMemo(
    () =>
      buildAnimalTemplateVariables({
        shelterName,
        animal: {
          name: animal.name,
          speciesName: animal.species.name,
          breedName: animal.breed.name,
          variantName: animal.variant?.label ?? null,
          arrivalDate: parseIsoDateOnly(animal.arrivalDate) ?? new Date(),
          adoptionPrice: animal.adoptionPrice,
          status: animal.status,
          caseManagerName: animal.caseManagerName,
          adopterName: animal.adopterName,
          departureDate: parseIsoDateOnly(animal.departureDate),
          biography: animal.biography,
          careProvided: animal.careProvided,
          notes: animal.notes,
        },
      }),
    [animal, shelterName],
  );

  const openCreateDocumentModal = () => {
    setEditingDocument(null);
    setDocumentModalOpen(true);
  };

  const loadFullDocument = async (document: AnimalDocumentListItem) => {
    setLoadingDocumentId(document.id);
    try {
      const result = await getAnimalDocument(shelterSlug, {
        id: document.id,
        animalId: animal.id,
      });
      return handleAction(result) as AnimalDocumentListItem;
    } finally {
      setLoadingDocumentId(null);
    }
  };

  const openEditDocumentModal = async (document: AnimalDocumentListItem) => {
    try {
      const full = await loadFullDocument(document);
      setEditingDocument(full);
      setDocumentModalOpen(true);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible de charger le document',
        color: 'danger',
      });
    }
  };

  const openViewDocument = async (document: AnimalDocumentListItem) => {
    try {
      const full = await loadFullDocument(document);
      setViewingDocument(full);
      setCopiedDocument(false);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible de charger le document',
        color: 'danger',
      });
    }
  };

  const handleCreateFreeTextDocument = async (values: {
    name: string;
    content: string;
  }) => {
    const result = await createFreeTextAnimalDocument(shelterSlug, {
      animalId: animal.id,
      ...values,
    });
    const created = handleAction(result) as AnimalDocumentListItem;
    setDocuments((current) => [created, ...current]);
    notifications.show({
      title: 'Document créé',
      message: '',
      color: 'teal',
    });
  };

  const handleCreateDocumentFromTemplate = async (values: {
    templateId: string;
    name: string;
    content: string;
  }) => {
    const result = await createAnimalDocumentFromTemplate(shelterSlug, {
      animalId: animal.id,
      ...values,
    });
    const created = handleAction(result) as AnimalDocumentListItem;
    setDocuments((current) => [created, ...current]);
    notifications.show({
      title: 'Document créé',
      message: '',
      color: 'teal',
    });
  };

  const handleUpdateDocument = async (values: {
    id: string;
    name: string;
    content: string;
  }) => {
    const result = await updateAnimalDocument(shelterSlug, {
      animalId: animal.id,
      ...values,
    });
    const updated = handleAction(result) as AnimalDocumentListItem;
    setDocuments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    notifications.show({
      title: 'Document mis à jour',
      message: '',
      color: 'teal',
    });
  };

  const handleCopyDocument = async () => {
    if (!viewingDocument?.content) return;

    try {
      await navigator.clipboard.writeText(viewingDocument.content);
      setCopiedDocument(true);
      notifications.show({
        title: 'Succès',
        message: 'Document copié dans le presse-papiers',
        color: 'teal',
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

  const handleCopyDocumentFromList = async (document: AnimalDocumentListItem) => {
    try {
      const full = await loadFullDocument(document);
      await navigator.clipboard.writeText(full.content);
      setCopiedDocumentId(document.id);
      notifications.show({
        title: 'Succès',
        message: 'Document copié dans le presse-papiers',
        color: 'teal',
      });
      setTimeout(() => setCopiedDocumentId(null), 2000);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message:
          error instanceof Error ? error.message : 'Impossible de copier le document',
        color: 'danger',
      });
    }
  };

  const handleDeleteDocument = async (document: AnimalDocumentListItem) => {
    try {
      const result = await deleteAnimalDocument(shelterSlug, {
        id: document.id,
        animalId: animal.id,
      });
      handleAction(result);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      notifications.show({
        title: 'Document supprimé',
        message: '',
        color: 'teal',
      });
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec de la suppression',
        color: 'danger',
      });
    }
  };

  return (
    <>
      <section>
        <Group justify="space-between" align="flex-start" mb="sm" wrap="wrap">
          <div>
            <Title order={3} className="shelter-display-title">
              Documents ({documents.length})
            </Title>
            <Text size="sm" c="dimmed">
              Documents rattachés à cette fiche animal.
            </Text>
          </div>
          {canUpdate ? (
            <Button
              color="terracotta"
              leftSection={<IconPlus size={16} />}
              onClick={openCreateDocumentModal}
            >
              Nouveau document
            </Button>
          ) : null}
        </Group>

        {documents.length === 0 ? (
          <Text size="sm" c="dimmed">
            Aucun document pour cet animal.
          </Text>
        ) : (
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
                      {document.source === 'template' ? 'Depuis un modèle' : 'Texte libre'} ·{' '}
                      {formatRpDate(document.createdAt)}
                    </Text>
                  </div>
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="terracotta"
                      aria-label={`Voir ${document.name}`}
                      loading={loadingDocumentId === document.id}
                      onClick={() => void openViewDocument(document)}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color={copiedDocumentId === document.id ? 'teal' : 'terracotta'}
                      aria-label={`Copier ${document.name}`}
                      loading={loadingDocumentId === document.id}
                      onClick={() => void handleCopyDocumentFromList(document)}
                    >
                      {copiedDocumentId === document.id ? (
                        <IconCheck size={16} />
                      ) : (
                        <IconCopy size={16} />
                      )}
                    </ActionIcon>
                    {canUpdate ? (
                      <>
                        <ActionIcon
                          variant="light"
                          color="terracotta"
                          aria-label={`Modifier ${document.name}`}
                          loading={loadingDocumentId === document.id}
                          onClick={() => void openEditDocumentModal(document)}
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
                    ) : null}
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </section>

      <Modal
        opened={viewingDocument !== null}
        onClose={() => {
          setViewingDocument(null);
          setCopiedDocument(false);
        }}
        title={viewingDocument?.name ?? 'Document'}
        size="90%"
        styles={{
          content: { maxWidth: '60rem' },
        }}
      >
        {viewingDocument ? (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                {viewingDocument.source === 'template' ? 'Depuis un modèle' : 'Texte libre'} ·{' '}
                {formatRpDate(viewingDocument.createdAt)}
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={copiedDocument ? <IconCheck size={16} /> : <IconCopy size={16} />}
                onClick={handleCopyDocument}
                color={copiedDocument ? 'teal' : 'terracotta'}
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
        ) : null}
      </Modal>

      {documentModalOpen ? (
        <AnimalDocumentModal
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
      ) : null}
    </>
  );
}
