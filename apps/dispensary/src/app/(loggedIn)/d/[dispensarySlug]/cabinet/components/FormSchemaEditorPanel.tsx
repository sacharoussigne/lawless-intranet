'use client';

import { useCallback, useMemo } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import type { CabinetFormSchemas, FormEntityType } from '@/lib/cabinet/formSchema';
import { DynamicFormRenderer } from './DynamicFormRenderer';
import { getSystemCardsPreview } from './CabinetFormSystemFieldsPreview';
import { useCabinetSchemaEditing } from '../hooks/useCabinetSchemaEditing';

type FormSchemaEditorPanelProps = {
  dispensarySlug: string;
  cabinetId: string;
  entityType: FormEntityType;
  formSchemas: CabinetFormSchemas;
  onSchemasSaved: (schemas: CabinetFormSchemas) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function FormSchemaEditorPanel({
  dispensarySlug,
  cabinetId,
  entityType,
  formSchemas,
  onSchemasSaved,
  onDirtyChange,
}: FormSchemaEditorPanelProps) {
  const {
    draftEntitySchema,
    savingSchema,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema,
    schemaNestedFlushToken,
    schemaFlushToken,
    isDirty,
  } = useCabinetSchemaEditing({
    dispensarySlug,
    cabinetId,
    entityType,
    formSchemas,
    onSchemasSaved,
    autoStart: true,
    onDirtyChange,
  });

  const systemCards = useMemo(() => getSystemCardsPreview(entityType), [entityType]);

  const handleSave = useCallback(() => {
    void saveSchemaEditing();
  }, [saveSchemaEditing]);

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button variant="subtle" color="slate" disabled={!isDirty} onClick={cancelSchemaEditing}>
          Annuler
        </Button>
        <Button color="sage" loading={savingSchema} disabled={!isDirty} onClick={handleSave}>
          Enregistrer le schéma
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        Les champs ci-dessous sont fixes pour toutes les fiches. Ajoutez des champs personnalisés
        dans les catégories suivantes.
      </Text>

      <DynamicFormRenderer
        schema={draftEntitySchema}
        values={{}}
        onChange={() => {}}
        systemCards={systemCards}
        mode="schema"
        onSchemaChange={setDraftEntitySchema}
        schemaNestedFlushToken={schemaNestedFlushToken}
        schemaFlushToken={schemaFlushToken}
      />
    </Stack>
  );
}
