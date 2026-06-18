'use client';

import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
  const [schemaNestedFlushToken, setSchemaNestedFlushToken] = useState(0);
  const [schemaFlushToken, setSchemaFlushToken] = useState(0);
  const draftEntitySchemaRef = useRef(draftEntitySchema);
  draftEntitySchemaRef.current = draftEntitySchema;

  const setDraftEntitySchemaTracked = useCallback(
    (value: FormEntitySchema | ((prev: FormEntitySchema) => FormEntitySchema)) => {
      setDraftEntitySchema((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        draftEntitySchemaRef.current = next;
        return next;
      });
    },
    [],
  );

  const startSchemaEditing = useCallback(() => {
    const schema = getEntitySchema(formSchemas, entityType);
    draftEntitySchemaRef.current = schema;
    setDraftEntitySchema(schema);
    setSchemaEditing(true);
  }, [formSchemas, entityType]);

  const cancelSchemaEditing = useCallback(() => {
    flushSync(() => setSchemaNestedFlushToken((t) => t + 1));
    flushSync(() => setSchemaFlushToken((t) => t + 1));
    const schema = getEntitySchema(formSchemas, entityType);
    draftEntitySchemaRef.current = schema;
    setDraftEntitySchema(schema);
    setSchemaEditing(false);
  }, [formSchemas, entityType]);

  const saveSchemaEditing = useCallback(async () => {
    setSavingSchema(true);
    try {
      flushSync(() => setSchemaNestedFlushToken((t) => t + 1));
      flushSync(() => setSchemaFlushToken((t) => t + 1));
      const result = await saveFormSchemaEntity(dispensarySlug, {
        cabinetId,
        entityType,
        schema: draftEntitySchemaRef.current,
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
  }, [dispensarySlug, cabinetId, entityType, onSchemasSaved]);

  return {
    schemaEditing,
    draftEntitySchema,
    savingSchema,
    schemaNestedFlushToken,
    schemaFlushToken,
    startSchemaEditing,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema: setDraftEntitySchemaTracked,
  };
}
