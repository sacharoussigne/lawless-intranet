'use client';

import { Button, Group, Stack, TextInput } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import type {
  CustomValues,
  FormEntitySchema,
} from '@/lib/cabinet/formSchema';
import type { CabinetDisplaySettings } from '@/lib/cabinet/displaySettings';
import { flattenFields } from '@/lib/cabinet/formSchema/flattenFields';
import type { CabinetFieldErrors } from '@/lib/cabinet/formErrors';
import {
  addCategory,
  addField,
  deleteCategory,
  deleteField,
  moveCategory,
  moveField,
  replaceField,
  updateCategoryName,
} from '@/lib/cabinet/formSchema/draftMutations';
import { FormCategoryCard } from './FormCategoryCard';

type DynamicFormRendererMode = 'values' | 'schema';

type DynamicFormRendererProps = {
  schema: FormEntitySchema;
  values: CustomValues;
  onChange: (fieldId: string, value: string | null) => void;
  onBatchChange?: (updates: Record<string, string | null>) => void;
  readOnly?: boolean;
  systemCards?: Record<string, React.ReactNode>;
  mode?: DynamicFormRendererMode;
  onSchemaChange?: (
    schema: FormEntitySchema | ((prev: FormEntitySchema) => FormEntitySchema),
  ) => void;
  fieldErrors?: CabinetFieldErrors;
  schemaNestedFlushToken?: number;
  schemaFlushToken?: number;
  displaySettings?: CabinetDisplaySettings;
  onFieldLabelColorChange?: (fieldId: string, color: string) => void;
  onFieldRemoved?: (fieldId: string) => void;
};

export function DynamicFormRenderer({
  schema,
  values,
  onChange,
  onBatchChange,
  readOnly,
  systemCards,
  mode = 'values',
  onSchemaChange,
  fieldErrors,
  schemaNestedFlushToken,
  schemaFlushToken,
  displaySettings,
  onFieldLabelColorChange,
  onFieldRemoved,
}: DynamicFormRendererProps) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const sortedCategories = useMemo(
    () => [...schema.categories].sort((a, b) => a.order - b.order),
    [schema.categories],
  );
  const schemaEditing = mode === 'schema';

  const mutateSchema = useCallback(
    (next: FormEntitySchema | ((prev: FormEntitySchema) => FormEntitySchema)) => {
      onSchemaChange?.(next);
    },
    [onSchemaChange],
  );

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    mutateSchema(addCategory(schema, newCategoryName));
    setNewCategoryName('');
  };

  return (
    <Stack gap="md">
      {sortedCategories.map((category, categoryIndex) => (
        <FormCategoryCard
          key={category.id}
          category={category}
          values={values}
          onChange={onChange}
          onBatchChange={onBatchChange}
          readOnly={readOnly}
          schemaEditing={schemaEditing}
          canMoveCategoryUp={categoryIndex > 0}
          canMoveCategoryDown={categoryIndex < sortedCategories.length - 1}
          onMoveCategory={
            schemaEditing
              ? (direction) => mutateSchema(moveCategory(schema, category.id, direction))
              : undefined
          }
          onRenameCategory={
            schemaEditing
              ? (name) => mutateSchema(updateCategoryName(schema, category.id, name))
              : undefined
          }
          onDeleteCategory={
            schemaEditing
              ? () => {
                  if (onFieldRemoved) {
                    for (const field of flattenFields(category.fields)) {
                      onFieldRemoved(field.id);
                    }
                  }
                  mutateSchema(deleteCategory(schema, category.id));
                }
              : undefined
          }
          onAddField={
            schemaEditing
              ? (partial) => mutateSchema(addField(schema, category.id, partial))
              : undefined
          }
          onUpdateField={
            schemaEditing
              ? (field) => mutateSchema((prev) => replaceField(prev, category.id, field))
              : undefined
          }
          onDeleteField={
            schemaEditing
              ? (fieldId) => {
                  onFieldRemoved?.(fieldId);
                  mutateSchema(deleteField(schema, category.id, fieldId));
                }
              : undefined
          }
          onMoveField={
            schemaEditing
              ? (fieldId, direction) =>
                  mutateSchema(moveField(schema, category.id, fieldId, direction))
              : undefined
          }
          fieldErrors={schemaEditing ? undefined : fieldErrors}
          schemaNestedFlushToken={schemaEditing ? schemaNestedFlushToken : undefined}
          schemaFlushToken={schemaEditing ? schemaFlushToken : undefined}
          fieldLabelColors={schemaEditing ? displaySettings?.fieldLabelColors : undefined}
          onFieldLabelColorChange={schemaEditing ? onFieldLabelColorChange : undefined}
          onFieldRemoved={schemaEditing ? onFieldRemoved : undefined}
        >
          {category.systemKey && systemCards?.[category.systemKey]}
        </FormCategoryCard>
      ))}

      {schemaEditing && (
        <Group align="flex-end">
          <TextInput
            label="Nouvelle catégorie"
            placeholder="Nom de la catégorie"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.currentTarget.value)}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCategory();
              }
            }}
          />
          <Button
            color="sage"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddCategory}
            disabled={!newCategoryName.trim()}
          >
            Ajouter
          </Button>
        </Group>
      )}
    </Stack>
  );
}
