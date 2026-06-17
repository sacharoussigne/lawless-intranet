'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { CustomValues, FormCategory, FormField, FormFieldType } from '@/lib/cabinet/formSchema';
import type { CabinetFieldErrors } from '@/lib/cabinet/formErrors';
import { DynamicFieldInput } from './DynamicFieldInput';
import { FormFieldSchemaRow } from './FormFieldSchemaRow';
import { InlineEditableText } from './InlineEditableText';
import { SchemaReorderButtons } from './SchemaReorderButtons';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'textarea', label: 'Zone de texte' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste déroulante' },
];

type FormCategoryCardProps = {
  category: FormCategory;
  values: CustomValues;
  onChange: (fieldId: string, value: string | null) => void;
  readOnly?: boolean;
  children?: React.ReactNode;
  schemaEditing?: boolean;
  onRenameCategory?: (name: string) => void;
  onDeleteCategory?: () => void;
  onAddField?: (partial: {
    label: string;
    type: FormFieldType;
    required: boolean;
    options?: string[];
    placeholder?: string;
    defaultValue?: string;
  }) => void;
  onUpdateField?: (field: FormField) => void;
  onDeleteField?: (fieldId: string) => void;
  onMoveField?: (fieldId: string, direction: 'up' | 'down') => void;
  fieldErrors?: CabinetFieldErrors;
  canMoveCategoryUp?: boolean;
  canMoveCategoryDown?: boolean;
  onMoveCategory?: (direction: 'up' | 'down') => void;
};

export function FormCategoryCard({
  category,
  values,
  onChange,
  readOnly,
  children,
  schemaEditing,
  onRenameCategory,
  onDeleteCategory,
  onAddField,
  onUpdateField,
  onDeleteField,
  onMoveField,
  fieldErrors,
  canMoveCategoryUp,
  canMoveCategoryDown,
  onMoveCategory,
}: FormCategoryCardProps) {
  const sortedFields = [...category.fields].sort((a, b) => a.order - b.order);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FormFieldType>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldDefaultValue, setNewFieldDefaultValue] = useState('');

  const resetNewFieldForm = () => {
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldPlaceholder('');
    setNewFieldDefaultValue('');
  };

  const showNewFieldPlaceholder =
    newFieldType === 'text' ||
    newFieldType === 'textarea' ||
    newFieldType === 'select' ||
    newFieldType === 'date';

  const handleAddField = () => {
    if (!newFieldLabel.trim() || !onAddField) return;
    onAddField({
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder.trim() || undefined,
      defaultValue: newFieldDefaultValue.trim() || undefined,
    });
    resetNewFieldForm();
  };

  if (schemaEditing) {
    return (
      <Card
        withBorder
        radius="sm"
        padding="md"
        style={{ borderColor: 'var(--mantine-color-leather-3)' }}
      >
        <Group justify="space-between" mb="md" align="center">
          <Group gap="sm" align="center">
            {category.isSystem ? (
              <>
                <Title order={4} className="disp-display-title">
                  {category.name}
                </Title>
                <Badge variant="outline" color="leather" size="sm">
                  Système
                </Badge>
              </>
            ) : (
              <Title order={4} className="disp-display-title">
                <InlineEditableText
                  value={category.name}
                  canEdit
                  onSave={(name) => onRenameCategory?.(name)}
                />
              </Title>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            {onMoveCategory && (
              <SchemaReorderButtons
                canMoveUp={canMoveCategoryUp ?? false}
                canMoveDown={canMoveCategoryDown ?? false}
                onMove={onMoveCategory}
              />
            )}
            {!category.isSystem && onDeleteCategory && (
              <ActionIcon variant="light" color="danger" onClick={onDeleteCategory}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        </Group>

        {children && (
          <Stack gap="md" mb="md">
            {children}
          </Stack>
        )}

        <Stack gap="sm">
          {sortedFields.map((field, fieldIndex) => (
            <FormFieldSchemaRow
              key={field.id}
              field={field}
              onChange={(updated) => onUpdateField?.(updated)}
              onDelete={() => onDeleteField?.(field.id)}
              canMoveUp={fieldIndex > 0}
              canMoveDown={fieldIndex < sortedFields.length - 1}
              onMove={
                onMoveField
                  ? (direction) => onMoveField(field.id, direction)
                  : undefined
              }
            />
          ))}
          {sortedFields.length === 0 && !children && (
            <Text size="sm" c="dimmed">
              Aucun champ personnalisé
            </Text>
          )}
        </Stack>

        {onAddField && (
          <Stack gap="sm" mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-slate-2)' }}>
            <Text size="sm" fw={500}>
              Nouveau champ
            </Text>
            <Group align="flex-end" wrap="wrap" grow>
              <TextInput
                label="Libellé"
                placeholder="Nom du champ"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.currentTarget.value)}
                style={{ flex: 1, minWidth: 160 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddField();
                  }
                }}
              />
              <Select
                label="Type"
                data={FIELD_TYPES}
                value={newFieldType}
                onChange={(v) => {
                  setNewFieldType((v as FormFieldType) ?? 'text');
                  setNewFieldDefaultValue('');
                }}
                style={{ minWidth: 160 }}
              />
              {showNewFieldPlaceholder && (
                <TextInput
                  label="Placeholder"
                  placeholder="Texte d'aide"
                  value={newFieldPlaceholder}
                  onChange={(e) => setNewFieldPlaceholder(e.currentTarget.value)}
                  style={{ flex: 1, minWidth: 160 }}
                />
              )}
              {(newFieldType === 'text' || newFieldType === 'textarea') && (
                <TextInput
                  label="Valeur par défaut"
                  value={newFieldDefaultValue}
                  onChange={(e) => setNewFieldDefaultValue(e.currentTarget.value)}
                  style={{ flex: 1, minWidth: 160 }}
                />
              )}
              {newFieldType === 'date' && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <RpDatePicker
                    label="Valeur par défaut"
                    value={newFieldDefaultValue || null}
                    clearable
                    onChange={(d) => setNewFieldDefaultValue(d ? d.toISOString() : '')}
                  />
                </div>
              )}
              <Switch
                label="Obligatoire"
                checked={newFieldRequired}
                onChange={(e) => setNewFieldRequired(e.currentTarget.checked)}
                mt="lg"
              />
              <Button
                color="sage"
                leftSection={<IconPlus size={16} />}
                onClick={handleAddField}
                disabled={!newFieldLabel.trim()}
              >
                Ajouter
              </Button>
            </Group>
          </Stack>
        )}
      </Card>
    );
  }

  return (
    <Card withBorder radius="sm" padding="md">
      <Title order={4} className="disp-display-title" mb="md">
        {category.name}
      </Title>
      <Stack gap="md">
        {children}
        {sortedFields.map((field) => (
          <DynamicFieldInput
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={onChange}
            readOnly={readOnly}
            values={values}
            fieldErrors={fieldErrors}
          />
        ))}
        {sortedFields.length === 0 && !children && (
          <Text size="sm" c="dimmed">
            Aucun champ personnalisé
          </Text>
        )}
      </Stack>
    </Card>
  );
}
