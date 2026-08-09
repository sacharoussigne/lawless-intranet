'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconPencil, IconPlus, IconTemplate, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { CabinetSelector } from '../components/CabinetSelector';
import type { CabinetSummaryDTO } from '@/types/cabinet';
import type { ConsultationDocumentTemplateListItem } from '@/types/cabinetDocuments';
import { tenantRoutes } from '@/types/routes';
import {
  deleteConsultationDocumentTemplate,
} from '@/app/_actions/cabinet/consultationDocumentTemplates';
import { handleAction } from '@/lib/action';

interface CabinetDocumentTemplatesPageClientProps {
  dispensarySlug: string;
  cabinets: CabinetSummaryDTO[];
  cabinetId: string;
  initialTemplates: ConsultationDocumentTemplateListItem[];
}

export function CabinetDocumentTemplatesPageClient({
  dispensarySlug,
  cabinets,
  cabinetId,
  initialTemplates,
}: CabinetDocumentTemplatesPageClientProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [search, setSearch] = useState('');

  const t = tenantRoutes(dispensarySlug);
  const selectedCabinet = useMemo(
    () => cabinets.find((cabinet) => cabinet.id === cabinetId) ?? null,
    [cabinetId, cabinets],
  );

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('fr');
    if (!normalizedSearch) return templates;

    return templates.filter((template) =>
      `${template.name} ${template.description ?? ''}`
        .toLocaleLowerCase('fr')
        .includes(normalizedSearch),
    );
  }, [search, templates]);

  const handleDelete = async (template: ConsultationDocumentTemplateListItem) => {
    try {
      const result = await deleteConsultationDocumentTemplate(dispensarySlug, {
        id: template.id,
        cabinetId,
      });
      handleAction(result);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      notifications.show({
        title: 'Template supprimé',
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

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Templates de documents"
        description={`Gestion des templates du cabinet ${selectedCabinet?.name ?? ''}`}
        backHref={`${t.cabinet.index}?cabinetId=${cabinetId}`}
        backLabel="Retour au cabinet"
        actions={
          <Group>
            {cabinets.length > 1 && (
              <CabinetSelector
                cabinets={cabinets}
                value={cabinetId}
                onChange={(nextCabinetId) => {
                    router.push(t.cabinet.templates(nextCabinetId));
                }}
              />
            )}
            <Button
              leftSection={<IconPlus size={16} />}
              color="sage"
              onClick={() => router.push(t.cabinet.newTemplate(cabinetId))}
            >
              Nouveau template
            </Button>
          </Group>
        }
      />

      <Stack gap="md">
        <TextInput
          placeholder="Rechercher un template…"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />

        <DataTable
          withTableBorder
          borderRadius="sm"
          highlightOnHover
          minHeight={filteredTemplates.length === 0 ? 200 : undefined}
          records={filteredTemplates}
          columns={[
            { accessor: 'name', title: 'Nom' },
            {
              accessor: 'defaultDocumentName',
              title: 'Nom par défaut',
              render: (template) => template.defaultDocumentName || '—',
            },
            {
              accessor: 'description',
              title: 'Description',
              render: (template) => template.description || '—',
            },
            {
              accessor: 'actions',
              title: '',
              textAlign: 'right',
              render: (template) => (
                <Group gap="xs" justify="flex-end">
                  <ActionIcon
                    variant="light"
                    color="slate"
                    onClick={() => router.push(t.cabinet.editTemplate(cabinetId, template.id))}
                  >
                    <IconPencil size={16} />
                  </ActionIcon>
                  <DeleteConfirmPopover
                    title="Supprimer le template ?"
                    message={`Le template « ${template.name} » sera supprimé.`}
                    onConfirm={() => handleDelete(template)}
                  >
                    <ActionIcon variant="light" color="danger">
                      <IconTrash size={16} />
                    </ActionIcon>
                  </DeleteConfirmPopover>
                </Group>
              ),
            },
          ]}
          emptyState={
            <Stack align="center" gap="xs" py="xl">
              <IconTemplate size={20} />
              <Text size="sm" c="dimmed">
                Aucun template pour ce cabinet.
              </Text>
            </Stack>
          }
        />
      </Stack>
    </Container>
  );
}
