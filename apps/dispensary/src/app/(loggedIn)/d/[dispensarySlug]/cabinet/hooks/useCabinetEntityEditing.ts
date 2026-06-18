'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import type { CabinetAccessLevel } from '@prisma/client';
import type {
  CabinetFormSchemas,
  CustomValues,
  FormEntitySchema,
  FormEntityType,
} from '@/lib/cabinet/formSchema';
import { getEntitySchema } from '@/lib/cabinet/formSchema';
import { useCabinetFieldErrors } from './useCabinetFieldErrors';
import { useCabinetSchemaEditing } from './useCabinetSchemaEditing';

type EntityWithFormData = {
  customValues: CustomValues;
  formSchemas: CabinetFormSchemas;
  accessLevel: CabinetAccessLevel | null;
};

type UseCabinetEntityEditingOptions<T extends EntityWithFormData> = {
  dispensarySlug: string;
  cabinetId: string;
  entityType: FormEntityType;
  initialEntity: T;
  canEditSchema: boolean;
  onSave: (entity: T, customValues: CustomValues) => Promise<void>;
};

export function useCabinetEntityEditing<T extends EntityWithFormData>({
  dispensarySlug,
  cabinetId,
  entityType,
  initialEntity,
  canEditSchema,
  onSave,
}: UseCabinetEntityEditingOptions<T>) {
  const [entity, setEntity] = useState(initialEntity);
  const [customValues, setCustomValues] = useState(initialEntity.customValues);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    fieldErrors,
    formError,
    clearFieldError,
    resetErrors,
    applySubmitError,
  } = useCabinetFieldErrors();

  const {
    schemaEditing,
    draftEntitySchema,
    savingSchema,
    startSchemaEditing,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema,
    schemaNestedFlushToken,
    schemaFlushToken,
  } = useCabinetSchemaEditing({
    dispensarySlug,
    cabinetId,
    entityType,
    formSchemas: entity.formSchemas,
    onSchemasSaved: (schemas) => setEntity((current) => ({ ...current, formSchemas: schemas })),
  });

  const entitySchema: FormEntitySchema = schemaEditing
    ? draftEntitySchema
    : getEntitySchema(entity.formSchemas, entityType);

  const startEditing = useCallback(() => {
    resetErrors();
    setCustomValues(entity.customValues);
    setEditing(true);
  }, [entity.customValues, resetErrors]);

  const cancelEditing = useCallback(() => {
    resetErrors();
    setCustomValues(entity.customValues);
    setEditing(false);
  }, [entity.customValues, resetErrors]);

  const handleCustomChange = useCallback(
    (fieldId: string, value: string | null) => {
      clearFieldError(fieldId);
      setCustomValues((prev) => ({ ...prev, [fieldId]: value }));
    },
    [clearFieldError],
  );

  const handleCustomBatchChange = useCallback(
    (updates: Record<string, string | null>) => {
      for (const fieldId of Object.keys(updates)) {
        clearFieldError(fieldId);
      }
      setCustomValues((prev) => ({ ...prev, ...updates }));
    },
    [clearFieldError],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    resetErrors();
    try {
      await onSave(entity, customValues);
      setEntity((current) => ({ ...current, customValues }));
      setEditing(false);
      notifications.show({ title: 'Enregistré', message: '', color: 'moss' });
    } catch (error: unknown) {
      applySubmitError(error);
    } finally {
      setSaving(false);
    }
  }, [applySubmitError, customValues, onSave, resetErrors]);

  return {
    entity,
    setEntity,
    customValues,
    editing,
    saving,
    startEditing,
    cancelEditing,
    handleSave,
    handleCustomChange,
    handleCustomBatchChange,
    fieldErrors,
    formError,
    clearFieldError,
    schemaEditing,
    draftEntitySchema,
    savingSchema,
    startSchemaEditing,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema,
    schemaNestedFlushToken,
    schemaFlushToken,
    entitySchema,
    canEditSchema,
  };
}
