'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { notifications } from '@mantine/notifications';
import { saveFormSchemaEntity } from '@/app/_actions/cabinet/formSchema';
import { handleAction } from '@/lib/action';
import type { CabinetDisplaySettings } from '@/lib/cabinet/displaySettings';
import {
  removeFieldLabelColorOverride,
  setFieldLabelColorOverride,
} from '@/lib/cabinet/displaySettings';
import type { CabinetFormSchemas, FormEntitySchema, FormEntityType } from '@/lib/cabinet/formSchema';
import { getEntitySchema } from '@/lib/cabinet/formSchema';

type UseCabinetSchemaEditingOptions = {
  dispensarySlug: string;
  cabinetId: string;
  entityType: FormEntityType;
  formSchemas: CabinetFormSchemas;
  displaySettings: CabinetDisplaySettings;
  onConfigurationSaved: (data: {
    formSchemas: CabinetFormSchemas;
    displaySettings: CabinetDisplaySettings;
  }) => void;
  autoStart?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
};

export function useCabinetSchemaEditing({
  dispensarySlug,
  cabinetId,
  entityType,
  formSchemas,
  displaySettings,
  onConfigurationSaved,
  autoStart = false,
  onDirtyChange,
}: UseCabinetSchemaEditingOptions) {
  const [schemaEditing, setSchemaEditing] = useState(autoStart);
  const [draftEntitySchema, setDraftEntitySchema] = useState<FormEntitySchema>(() =>
    getEntitySchema(formSchemas, entityType),
  );
  const [draftDisplaySettings, setDraftDisplaySettings] =
    useState<CabinetDisplaySettings>(displaySettings);
  const [savingSchema, setSavingSchema] = useState(false);
  const [schemaNestedFlushToken, setSchemaNestedFlushToken] = useState(0);
  const [schemaFlushToken, setSchemaFlushToken] = useState(0);
  const draftEntitySchemaRef = useRef(draftEntitySchema);
  draftEntitySchemaRef.current = draftEntitySchema;
  const draftDisplaySettingsRef = useRef(draftDisplaySettings);
  draftDisplaySettingsRef.current = draftDisplaySettings;

  const savedEntitySchema = useMemo(
    () => getEntitySchema(formSchemas, entityType),
    [formSchemas, entityType],
  );

  const isSchemaDirty = useMemo(
    () => JSON.stringify(draftEntitySchema) !== JSON.stringify(savedEntitySchema),
    [draftEntitySchema, savedEntitySchema],
  );

  const isDisplaySettingsDirty = useMemo(
    () => JSON.stringify(draftDisplaySettings) !== JSON.stringify(displaySettings),
    [draftDisplaySettings, displaySettings],
  );

  const isDirty = isSchemaDirty || isDisplaySettingsDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const schema = getEntitySchema(formSchemas, entityType);
    draftEntitySchemaRef.current = schema;
    setDraftEntitySchema(schema);
    draftDisplaySettingsRef.current = displaySettings;
    setDraftDisplaySettings(displaySettings);
  }, [formSchemas, entityType, displaySettings]);

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

  const setFieldLabelColor = useCallback((fieldId: string, color: string) => {
    setDraftDisplaySettings((prev) => {
      const next = setFieldLabelColorOverride(prev, fieldId, color);
      draftDisplaySettingsRef.current = next;
      return next;
    });
  }, []);

  const removeFieldLabelColor = useCallback((fieldId: string) => {
    setDraftDisplaySettings((prev) => {
      const next = removeFieldLabelColorOverride(prev, fieldId);
      draftDisplaySettingsRef.current = next;
      return next;
    });
  }, []);

  const resetDraftToSaved = useCallback(() => {
    flushSync(() => setSchemaNestedFlushToken((t) => t + 1));
    flushSync(() => setSchemaFlushToken((t) => t + 1));
    const schema = getEntitySchema(formSchemas, entityType);
    draftEntitySchemaRef.current = schema;
    setDraftEntitySchema(schema);
    draftDisplaySettingsRef.current = displaySettings;
    setDraftDisplaySettings(displaySettings);
  }, [formSchemas, entityType, displaySettings]);

  const startSchemaEditing = useCallback(() => {
    resetDraftToSaved();
    setSchemaEditing(true);
  }, [resetDraftToSaved]);

  const cancelSchemaEditing = useCallback(() => {
    resetDraftToSaved();
    if (!autoStart) {
      setSchemaEditing(false);
    }
  }, [autoStart, resetDraftToSaved]);

  const saveSchemaEditing = useCallback(async () => {
    setSavingSchema(true);
    try {
      flushSync(() => setSchemaNestedFlushToken((t) => t + 1));
      flushSync(() => setSchemaFlushToken((t) => t + 1));
      const result = await saveFormSchemaEntity(dispensarySlug, {
        cabinetId,
        entityType,
        schema: draftEntitySchemaRef.current,
        displaySettings: isDisplaySettingsDirty
          ? draftDisplaySettingsRef.current
          : undefined,
      });
      const data = handleAction(result) as
        | { formSchemas: CabinetFormSchemas; displaySettings: CabinetDisplaySettings }
        | undefined;
      if (data) {
        onConfigurationSaved(data);
        const schema = getEntitySchema(data.formSchemas, entityType);
        draftEntitySchemaRef.current = schema;
        setDraftEntitySchema(schema);
        draftDisplaySettingsRef.current = data.displaySettings;
        setDraftDisplaySettings(data.displaySettings);
        if (!autoStart) {
          setSchemaEditing(false);
        }
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
  }, [
    autoStart,
    cabinetId,
    dispensarySlug,
    entityType,
    isDisplaySettingsDirty,
    onConfigurationSaved,
  ]);

  return {
    schemaEditing: autoStart || schemaEditing,
    draftEntitySchema,
    draftDisplaySettings,
    savingSchema,
    isDirty,
    schemaNestedFlushToken,
    schemaFlushToken,
    startSchemaEditing,
    cancelSchemaEditing,
    saveSchemaEditing,
    setDraftEntitySchema: setDraftEntitySchemaTracked,
    setFieldLabelColor,
    removeFieldLabelColor,
  };
}
