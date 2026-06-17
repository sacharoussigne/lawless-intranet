'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { saveFormSchemaEntity } from '@/app/_actions/cabinet/formSchema';
import { handleAction } from '@/lib/action';
import type { CabinetFormSchemas, FormEntitySchema, FormEntityType } from '@/lib/cabinet/formSchema';
import { getEntitySchema } from '@/lib/cabinet/formSchema';

type UseCabinetSchemaEditingOptions = {
  dispensarySlug: string;
  cabinetId: string;
  entityType: FormEntityType;
  formSchemas: CabinetFormSchemas;
  onSchemasSaved: (schemas: CabinetFormSchemas) => void;
};

export function useCabinetSchemaEditing({
  dispensarySlug,
  cabinetId,
  entityType,
  formSchemas,
  onSchemasSaved,
}: UseCabinetSchemaEditingOptions) {
  const [schemaEditing, setSchemaEditing] = useState(false);
  const [draftEntitySchema, setDraftEntitySchema] = useState<FormEntitySchema>(() =>
    getEntitySchema(formSchemas, entityType),
  );
  const [savingSchema, setSavingSchema] = useState(false);

  const startSchemaEditing = useCallback(() => {
    setDraftEntitySchema(getEntitySchema(formSchemas, entityType));
    setSchemaEditing(true);
  }, [formSchemas, entityType]);

  const cancelSchemaEditing = useCallback(() => {
    setDraftEntitySchema(getEntitySchema(formSchemas, entityType));
    setSchemaEditing(false);
  }, [formSchemas, entityType]);

  const saveSchemaEditing = useCallback(async () => {
    setSavingSchema(true);
    try {
      const result = await saveFormSchemaEntity(dispensarySlug, {
        cabinetId,
        entityType,
        schema: draftEntitySchema,
      });
      const data = handleAction(result) as CabinetFormSchemas | undefined;
      if (data) {
        onSchemasSaved(data);
        setSchemaEditing(false);
        notifications.show({ title: 'Schéma enregistré', message: '', color: 'moss' });
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    } finally {
      setSavingSchema(false);
    }
  }, [dispensarySlug, cabinetId, entityType, draftEntitySchema, onSchemasSaved]);

  return {
    schemaEditing,
    draftEntitySchema,
    savingSchema,
    startSchemaEditing,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema,
  };
}
