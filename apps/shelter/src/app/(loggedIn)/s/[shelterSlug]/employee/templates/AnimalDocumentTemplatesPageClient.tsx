'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { IconArrowLeft, IconPencil, IconPlus, IconTemplate, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { ActiveFilters } from '@/app/_components/ActiveFilters/ActiveFilters';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { deleteAnimalDocumentTemplate } from '@/app/_actions/animalDocumentTemplates';
import { handleAction } from '@/lib/action';
import { useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import type { AnimalDocumentTemplateListItem } from '@/types/animalDocuments';

interface AnimalDocumentTemplatesPageClientProps {
  shelterSlug: string;
  initialTemplates: AnimalDocumentTemplateListItem[];
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('fr');
}

function compareTemplates(
  a: AnimalDocumentTemplateListItem,
  b: AnimalDocumentTemplateListItem,
  columnAccessor: string,
  direction: 'asc' | 'desc',
) {
  const factor = direction === 'asc' ? 1 : -1;
  const left =
    columnAccessor === 'defaultDocumentName'
      ? (a.defaultDocumentName ?? '')
      : columnAccessor === 'description'
        ? (a.description ?? '')
        : a.name;
  const right =
    columnAccessor === 'defaultDocumentName'
      ? (b.defaultDocumentName ?? '')
      : columnAccessor === 'description'
        ? (b.description ?? '')
        : b.name;

  return left.localeCompare(right, 'fr', { sensitivity: 'base' }) * factor;
}

export function AnimalDocumentTemplatesPageClient({
  shelterSlug,
  initialTemplates,
}: AnimalDocumentTemplatesPageClientProps) {
  const router = useRouter();
  const t = useTenantRoutes();
  const [templates, setTemplates] = useState(initialTemplates);
  const [nameFilter, setNameFilter] = useState('');
  const [defaultDocumentNameFilter, setDefaultDocumentNameFilter] = useState('');
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [sortStatus, setSortStatus] = useState<
    DataTableSortStatus<AnimalDocumentTemplateListItem>
  >({
    columnAccessor: 'name',
    direction: 'asc',
  });

  const filteredTemplates = useMemo(() => {
    const nameQuery = normalize(nameFilter);
    const defaultNameQuery = normalize(defaultDocumentNameFilter);
    const descriptionQuery = normalize(descriptionFilter);

    return templates.filter((template) => {
      if (nameQuery && !normalize(template.name).includes(nameQuery)) {
        return false;
      }
      if (
        defaultNameQuery &&
        !normalize(template.defaultDocumentName ?? '').includes(defaultNameQuery)
      ) {
        return false;
      }
      if (
        descriptionQuery &&
        !normalize(template.description ?? '').includes(descriptionQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [templates, nameFilter, defaultDocumentNameFilter, descriptionFilter]);

  const sortedTemplates = useMemo(
    () =>
      [...filteredTemplates].sort((a, b) =>
        compareTemplates(a, b, String(sortStatus.columnAccessor), sortStatus.direction),
      ),
    [filteredTemplates, sortStatus],
  );

  const handleDelete = async (template: AnimalDocumentTemplateListItem) => {
    try {
      const result = await deleteAnimalDocumentTemplate(shelterSlug, {
        id: template.id,
      });
      handleAction(result);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      notifications.show({
        title: 'Modèle supprimé',
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
    <Container size="xl">
      <Group mb="md">
        <Button
          variant="subtle"
          color="terracotta"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push(t.employee.index)}
        >
          Retour
        </Button>
      </Group>

      <PageHeader
        title="Modèles de documents"
        description="Modèles utilisés pour générer des documents sur les fiches animal."
      />

      <Stack gap="md">
        <Group justify="flex-end">
          <Button
            leftSection={<IconPlus size={16} />}
            color="terracotta"
            onClick={() => router.push(t.employee.templateNew)}
          >
            Nouveau modèle
          </Button>
        </Group>

        <ActiveFilters
          filters={[
            {
              label: 'Nom',
              value: nameFilter,
              onRemove: () => setNameFilter(''),
            },
            {
              label: 'Nom par défaut',
              value: defaultDocumentNameFilter,
              onRemove: () => setDefaultDocumentNameFilter(''),
            },
            {
              label: 'Description',
              value: descriptionFilter,
              onRemove: () => setDescriptionFilter(''),
            },
          ]}
        />

        <Paper shadow="sm" p="md" withBorder>
          <DataTable
            highlightOnHover
            minHeight={sortedTemplates.length === 0 ? 200 : undefined}
            records={sortedTemplates}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            columns={[
              {
                accessor: 'name',
                title: 'Nom',
                sortable: true,
                filtering: nameFilter.trim().length > 0,
                filter: (
                  <TextInput
                    placeholder="Rechercher un nom…"
                    value={nameFilter}
                    onChange={(event) => setNameFilter(event.currentTarget.value)}
                    style={{ minWidth: 180 }}
                  />
                ),
              },
              {
                accessor: 'defaultDocumentName',
                title: 'Nom par défaut',
                sortable: true,
                filtering: defaultDocumentNameFilter.trim().length > 0,
                render: (template) => template.defaultDocumentName || '—',
                filter: (
                  <TextInput
                    placeholder="Rechercher un nom par défaut…"
                    value={defaultDocumentNameFilter}
                    onChange={(event) =>
                      setDefaultDocumentNameFilter(event.currentTarget.value)
                    }
                    style={{ minWidth: 200 }}
                  />
                ),
              },
              {
                accessor: 'description',
                title: 'Description',
                sortable: true,
                filtering: descriptionFilter.trim().length > 0,
                render: (template) => template.description || '—',
                filter: (
                  <TextInput
                    placeholder="Rechercher une description…"
                    value={descriptionFilter}
                    onChange={(event) => setDescriptionFilter(event.currentTarget.value)}
                    style={{ minWidth: 200 }}
                  />
                ),
              },
              {
                accessor: 'actions',
                title: '',
                textAlign: 'right',
                render: (template) => (
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="terracotta"
                      onClick={() => router.push(t.employee.templateEdit(template.id))}
                      aria-label={`Modifier ${template.name}`}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <DeleteConfirmPopover
                      title="Supprimer le modèle ?"
                      message={`Le modèle « ${template.name} » sera supprimé.`}
                      onConfirm={() => handleDelete(template)}
                    >
                      <ActionIcon
                        variant="light"
                        color="danger"
                        aria-label={`Supprimer ${template.name}`}
                      >
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
                  {templates.length === 0
                    ? 'Aucun modèle pour ce refuge.'
                    : 'Aucun modèle ne correspond aux filtres.'}
                </Text>
              </Stack>
            }
          />
        </Paper>
      </Stack>
    </Container>
  );
}
