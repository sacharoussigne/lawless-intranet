'use client';

import { useCallback, useMemo } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import type { CabinetDisplaySettings } from '@/lib/cabinet/displaySettings';
import type { CabinetFormSchemas, FormEntityType } from '@/lib/cabinet/formSchema';
import { DynamicFormRenderer } from './DynamicFormRenderer';
import { getSystemCardsPreview } from './CabinetFormSystemFieldsPreview';
import { useCabinetSchemaEditing } from '../hooks/useCabinetSchemaEditing';

type FormSchemaEditorPanelProps = {
  dispensarySlug: string;
  cabinetId: string;
  entityType: FormEntityType;
  formSchemas: CabinetFormSchemas;
  displaySettings: CabinetDisplaySettings;
  onConfigurationSaved: (data: {
    formSchemas: CabinetFormSchemas;
    displaySettings: CabinetDisplaySettings;
  }) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function FormSchemaEditorPanel({
  dispensarySlug,
  cabinetId,
  entityType,
  formSchemas,
  displaySettings,
  onConfigurationSaved,
  onDirtyChange,
}: FormSchemaEditorPanelProps) {
  const {
    draftEntitySchema,
    draftDisplaySettings,
    savingSchema,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema,
    setFieldLabelColor,
    removeFieldLabelColor,
    schemaNestedFlushToken,
    schemaFlushToken,
    isDirty,
  } = useCabinetSchemaEditing({
    dispensarySlug,
    cabinetId,
    entityType,
    formSchemas,
    displaySettings,
    onConfigurationSaved,
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
        dans les catégories suivantes. Vous pouvez surcharger la couleur du libellé par champ.
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
        displaySettings={draftDisplaySettings}
        onFieldLabelColorChange={setFieldLabelColor}
        onFieldRemoved={removeFieldLabelColor}
      />
    </Stack>
  );
}
