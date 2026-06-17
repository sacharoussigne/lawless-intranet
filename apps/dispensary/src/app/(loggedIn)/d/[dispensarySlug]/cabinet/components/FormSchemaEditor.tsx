'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Button,
  Drawer,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { randomUUID } from '@/lib/randomId';
import type {
  CabinetFormSchemas,
  FormEntityType,
  FormField,
  FormFieldType,
} from '@/lib/cabinet/formSchema';
import { getEntitySchema } from '@/lib/cabinet/formSchema';
import {
  addFormCategory,
  addFormField,
  deleteFormCategory,
  deleteFormField,
} from '@/app/_actions/cabinet/formSchema';
import { handleAction } from '@/lib/action';

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'textarea', label: 'Zone de texte' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste déroulante' },
];

const ENTITY_LABELS: Record<FormEntityType, string> = {
  patient: 'Patient',
  careEpisode: 'Prise en charge',
  consultation: 'Consultation',
};

interface FormSchemaEditorProps {
  opened: boolean;
  onClose: () => void;
  dispensarySlug: string;
  cabinetId: string;
  entityType: FormEntityType;
  initialSchemas: CabinetFormSchemas;
  onSchemasChange: (schemas: CabinetFormSchemas) => void;
}

export function FormSchemaEditor({
  opened,
  onClose,
  dispensarySlug,
  cabinetId,
  entityType,
  initialSchemas,
  onSchemasChange,
}: FormSchemaEditorProps) {
  const [schemas, setSchemas] = useState(initialSchemas);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<FormFieldType>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [selectOptions, setSelectOptions] = useState('');

  const entitySchema = getEntitySchema(schemas, entityType);
  const sortedCategories = [...entitySchema.categories].sort((a, b) => a.order - b.order);
  const selectedCategory = sortedCategories.find((c) => c.id === selectedCategoryId);

  useEffect(() => {
    if (opened) {
      setSchemas(initialSchemas);
      const first = getEntitySchema(initialSchemas, entityType).categories[0];
      setSelectedCategoryId(first?.id ?? null);
    }
  }, [opened, initialSchemas, entityType]);

  const applySchemas = useCallback(
    (next: CabinetFormSchemas) => {
      setSchemas(next);
      onSchemasChange(next);
    },
    [onSchemasChange],
  );

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const result = await addFormCategory(dispensarySlug, {
        cabinetId,
        entityType,
        name: newCategoryName.trim(),
      });
      const data = handleAction(result);
      if (data) applySchemas(data as CabinetFormSchemas);
      setNewCategoryName('');
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const result = await deleteFormCategory(dispensarySlug, {
        cabinetId,
        entityType,
        categoryId,
      });
      const data = handleAction(result);
      if (data) applySchemas(data as CabinetFormSchemas);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  const handleAddField = async () => {
    if (!selectedCategoryId || !fieldLabel.trim()) return;

    const maxOrder = selectedCategory?.fields.reduce((m, f) => Math.max(m, f.order), -1) ?? -1;
    const field: FormField = {
      id: randomUUID(),
      type: fieldType,
      label: fieldLabel.trim(),
      required: fieldRequired,
      order: maxOrder + 1,
    };

    if (fieldType === 'select') {
      const lines = selectOptions
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      field.options = lines.map((label) => ({ id: randomUUID(), label }));
    }

    try {
      const result = await addFormField(dispensarySlug, {
        cabinetId,
        entityType,
        categoryId: selectedCategoryId,
        field,
      });
      const data = handleAction(result);
      if (data) applySchemas(data as CabinetFormSchemas);
      setFieldLabel('');
      setSelectOptions('');
      setFieldRequired(false);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  const handleDeleteField = async (categoryId: string, fieldId: string) => {
    try {
      const result = await deleteFormField(dispensarySlug, {
        cabinetId,
        entityType,
        categoryId,
        fieldId,
      });
      const data = handleAction(result);
      if (data) applySchemas(data as CabinetFormSchemas);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={`Schéma — ${ENTITY_LABELS[entityType]}`}
      position="right"
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Ajoutez des catégories et champs personnalisés. Les catégories système ne peuvent pas être supprimées.
        </Text>

        <Group align="flex-end">
          <TextInput
            label="Nouvelle catégorie"
            placeholder="Nom de la catégorie"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button color="sage" leftSection={<IconPlus size={16} />} onClick={() => void handleAddCategory()}>
            Ajouter
          </Button>
        </Group>

        <Select
          label="Catégorie cible"
          data={sortedCategories.map((c) => ({
            value: c.id,
            label: c.isSystem ? `${c.name} (système)` : c.name,
          }))}
          value={selectedCategoryId}
          onChange={setSelectedCategoryId}
        />

        {selectedCategory && !selectedCategory.isSystem && (
          <Button
            variant="light"
            color="danger"
            size="xs"
            leftSection={<IconTrash size={14} />}
            onClick={() => void handleDeleteCategory(selectedCategory.id)}
          >
            Supprimer cette catégorie
          </Button>
        )}

        {selectedCategory && (
          <Stack gap="xs">
            <Text fw={500} size="sm">
              Champs dans « {selectedCategory.name} »
            </Text>
            {[...selectedCategory.fields]
              .sort((a, b) => a.order - b.order)
              .map((field) => (
                <Group key={field.id} justify="space-between">
                  <Text size="sm">
                    {field.label} ({field.type})
                    {field.required && ' *'}
                  </Text>
                  <ActionIcon
                    variant="light"
                    color="danger"
                    size="sm"
                    onClick={() => void handleDeleteField(selectedCategory.id, field.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
          </Stack>
        )}

        <hr className="disp-section-divider" />

        <Text fw={500} size="sm">
          Nouveau champ
        </Text>
        <TextInput
          label="Libellé"
          value={fieldLabel}
          onChange={(e) => setFieldLabel(e.currentTarget.value)}
        />
        <Select
          label="Type"
          data={FIELD_TYPES}
          value={fieldType}
          onChange={(v) => setFieldType((v as FormFieldType) ?? 'text')}
        />
        <Switch
          label="Obligatoire"
          checked={fieldRequired}
          onChange={(e) => setFieldRequired(e.currentTarget.checked)}
        />
        {fieldType === 'select' && (
          <Textarea
            label="Options (une par ligne)"
            value={selectOptions}
            onChange={(e) => setSelectOptions(e.currentTarget.value)}
            minRows={3}
          />
        )}
        <Button color="sage" onClick={() => void handleAddField()}>
          Ajouter le champ
        </Button>
      </Stack>
    </Drawer>
  );
}
