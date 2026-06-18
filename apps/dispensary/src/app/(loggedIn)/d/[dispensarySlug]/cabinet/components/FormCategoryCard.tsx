'use client';

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
import { FIELD_TYPES } from '@/lib/cabinet/formSchema';
import type { CabinetFieldErrors } from '@/lib/cabinet/formErrors';
import { DynamicFieldInput } from './DynamicFieldInput';
import { FormFieldSchemaRow } from './FormFieldSchemaRow';
import { InlineEditableText } from './InlineEditableText';
import { SchemaReorderButtons } from './SchemaReorderButtons';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';

type FormCategoryCardProps = {
  category: FormCategory;
  values: CustomValues;
  onChange: (fieldId: string, value: string | null) => void;
  onBatchChange?: (updates: Record<string, string | null>) => void;
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
    editable?: boolean;
  }) => void;
  onUpdateField?: (field: FormField) => void;
  onDeleteField?: (fieldId: string) => void;
  onMoveField?: (fieldId: string, direction: 'up' | 'down') => void;
  fieldErrors?: CabinetFieldErrors;
  canMoveCategoryUp?: boolean;
  canMoveCategoryDown?: boolean;
  onMoveCategory?: (direction: 'up' | 'down') => void;
  schemaNestedFlushToken?: number;
  schemaFlushToken?: number;
};

export const FormCategoryCard = memo(function FormCategoryCard({
  category,
  values,
  onChange,
  onBatchChange,
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
  schemaNestedFlushToken,
  schemaFlushToken,
}: FormCategoryCardProps) {
  const sortedFields = useMemo(
    () => [...category.fields].sort((a, b) => a.order - b.order),
    [category.fields],
  );
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FormFieldType>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldDefaultValue, setNewFieldDefaultValue] = useState('');
  const [newFieldEditable, setNewFieldEditable] = useState(true);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const lastSchemaFlushTokenRef = useRef(0);

  useLayoutEffect(() => {
    if (schemaFlushToken === undefined) return;
    if (schemaFlushToken <= lastSchemaFlushTokenRef.current) return;
    lastSchemaFlushTokenRef.current = schemaFlushToken;
    if (expandedFieldId !== null) {
      flushSync(() => setExpandedFieldId(null));
    }
  }, [schemaFlushToken, expandedFieldId]);

  const onUpdateFieldRef = useRef(onUpdateField);
  const onDeleteFieldRef = useRef(onDeleteField);
  const onMoveFieldRef = useRef(onMoveField);
  onUpdateFieldRef.current = onUpdateField;
  onDeleteFieldRef.current = onDeleteField;
  onMoveFieldRef.current = onMoveField;

  const handleFieldChange = useCallback((updated: FormField) => {
    onUpdateFieldRef.current?.(updated);
  }, []);

  const handleFieldExpandedChange = useCallback((fieldId: string, next: boolean) => {
    setExpandedFieldId((current) => {
      if (next) return fieldId;
      return current === fieldId ? null : current;
    });
  }, []);

  const resetNewFieldForm = () => {
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldPlaceholder('');
    setNewFieldDefaultValue('');
    setNewFieldEditable(true);
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
      editable: newFieldDefaultValue.trim() ? newFieldEditable : undefined,
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
              expanded={expandedFieldId === field.id}
              onExpandedChange={(next) => handleFieldExpandedChange(field.id, next)}
              onChange={handleFieldChange}
              schemaNestedFlushToken={schemaNestedFlushToken}
              onDelete={() => onDeleteFieldRef.current?.(field.id)}
              canMoveUp={fieldIndex > 0}
              canMoveDown={fieldIndex < sortedFields.length - 1}
              onMove={
                onMoveFieldRef.current
                  ? (direction) => onMoveFieldRef.current?.(field.id, direction)
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
                  setNewFieldEditable(true);
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
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setNewFieldDefaultValue(value);
                    if (!value.trim()) setNewFieldEditable(true);
                  }}
                  style={{ flex: 1, minWidth: 160 }}
                />
              )}
              {newFieldType === 'date' && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <RpDatePicker
                    label="Valeur par défaut"
                    value={newFieldDefaultValue || null}
                    clearable
                    onChange={(d) => {
                      const iso = d ? d.toISOString() : '';
                      setNewFieldDefaultValue(iso);
                      if (!iso) setNewFieldEditable(true);
                    }}
                  />
                </div>
              )}
              {newFieldDefaultValue && (
                <Switch
                  label="Modifiable"
                  checked={newFieldEditable}
                  onChange={(e) => setNewFieldEditable(e.currentTarget.checked)}
                  mt="lg"
                />
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
      <Stack gap="md" style={{ minWidth: 0 }}>
        {children}
        {sortedFields.map((field) => (
          <DynamicFieldInput
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={onChange}
            onBatchChange={onBatchChange}
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
});
