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
import { IconArrowLeft, IconPencil, IconPlus, IconTemplate, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { deleteAnimalDocumentTemplate } from '@/app/_actions/animalDocumentTemplates';
import { handleAction } from '@/lib/action';
import { useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import type { AnimalDocumentTemplateListItem } from '@/types/animalDocuments';

interface AnimalDocumentTemplatesPageClientProps {
  shelterSlug: string;
  initialTemplates: AnimalDocumentTemplateListItem[];
}

export function AnimalDocumentTemplatesPageClient({
  shelterSlug,
  initialTemplates,
}: AnimalDocumentTemplatesPageClientProps) {
  const router = useRouter();
  const t = useTenantRoutes();
  const [templates, setTemplates] = useState(initialTemplates);
  const [search, setSearch] = useState('');

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('fr');
    if (!normalizedSearch) return templates;

    return templates.filter((template) =>
      `${template.name} ${template.description ?? ''}`
        .toLocaleLowerCase('fr')
        .includes(normalizedSearch),
    );
  }, [search, templates]);

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
        <Group justify="space-between" wrap="wrap">
          <TextInput
            placeholder="Rechercher un modèle…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Button
            leftSection={<IconPlus size={16} />}
            color="terracotta"
            onClick={() => router.push(t.employee.templateNew)}
          >
            Nouveau modèle
          </Button>
        </Group>

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
                    color="gray"
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
                    <ActionIcon variant="light" color="danger" aria-label={`Supprimer ${template.name}`}>
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
                Aucun modèle pour ce refuge.
              </Text>
            </Stack>
          }
        />
      </Stack>
    </Container>
  );
}
