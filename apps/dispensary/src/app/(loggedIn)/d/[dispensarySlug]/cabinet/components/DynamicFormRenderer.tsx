'use client';

import { Button, Group, Stack, TextInput } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import type {
  CustomValues,
  FormEntitySchema,
} from '@/lib/cabinet/formSchema';
import {
  addCategory,
  addField,
  deleteCategory,
  deleteField,
  updateCategoryName,
  updateField,
} from '@/lib/cabinet/formSchema/draftMutations';
import { FormCategoryCard } from './FormCategoryCard';

export type DynamicFormRendererMode = 'values' | 'schema';

type DynamicFormRendererProps = {
  schema: FormEntitySchema;
  values: CustomValues;
  onChange: (fieldId: string, value: string | null) => void;
  readOnly?: boolean;
  systemCards?: Record<string, React.ReactNode>;
  mode?: DynamicFormRendererMode;
  onSchemaChange?: (schema: FormEntitySchema) => void;
};

export function DynamicFormRenderer({
  schema,
  values,
  onChange,
  readOnly,
  systemCards,
  mode = 'values',
  onSchemaChange,
}: DynamicFormRendererProps) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const sortedCategories = [...schema.categories].sort((a, b) => a.order - b.order);
  const schemaEditing = mode === 'schema';

  const mutateSchema = (next: FormEntitySchema) => {
    onSchemaChange?.(next);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    mutateSchema(addCategory(schema, newCategoryName));
    setNewCategoryName('');
  };

  return (
    <Stack gap="md">
      {sortedCategories.map((category) => (
        <FormCategoryCard
          key={category.id}
          category={category}
          values={values}
          onChange={onChange}
          readOnly={readOnly}
          schemaEditing={schemaEditing}
          onRenameCategory={
            schemaEditing
              ? (name) => mutateSchema(updateCategoryName(schema, category.id, name))
              : undefined
          }
          onDeleteCategory={
            schemaEditing
              ? () => mutateSchema(deleteCategory(schema, category.id))
              : undefined
          }
          onAddField={
            schemaEditing
              ? (partial) => mutateSchema(addField(schema, category.id, partial))
              : undefined
          }
          onUpdateField={
            schemaEditing
              ? (fieldId, updates) => mutateSchema(updateField(schema, category.id, fieldId, updates))
              : undefined
          }
          onDeleteField={
            schemaEditing
              ? (fieldId) => mutateSchema(deleteField(schema, category.id, fieldId))
              : undefined
          }
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
