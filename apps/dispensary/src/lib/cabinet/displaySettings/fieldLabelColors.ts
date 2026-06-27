import type { CabinetFormSchemas } from '@/lib/cabinet/formSchema';
import { flattenFieldsFromCategories } from '@/lib/cabinet/formSchema/flattenFields';
import type { CabinetDisplaySettings } from './types';

export function getFieldLabelColorOverride(
  settings: CabinetDisplaySettings,
  fieldId: string,
): string | undefined {
  const color = settings.fieldLabelColors?.[fieldId];
  return color ?? undefined;
}

export function setFieldLabelColorOverride(
  settings: CabinetDisplaySettings,
  fieldId: string,
  color: string,
): CabinetDisplaySettings {
  const trimmed = color.trim();
  const nextFieldColors = { ...settings.fieldLabelColors };

  if (!trimmed) {
    delete nextFieldColors[fieldId];
  } else {
    nextFieldColors[fieldId] = trimmed;
  }

  return {
    ...settings,
    fieldLabelColors:
      Object.keys(nextFieldColors).length > 0 ? nextFieldColors : undefined,
  };
}

export function removeFieldLabelColorOverride(
  settings: CabinetDisplaySettings,
  fieldId: string,
): CabinetDisplaySettings {
  if (!settings.fieldLabelColors?.[fieldId]) {
    return settings;
  }
  return setFieldLabelColorOverride(settings, fieldId, '');
}

export function removeFieldLabelColorOverrides(
  settings: CabinetDisplaySettings,
  fieldIds: string[],
): CabinetDisplaySettings {
  let next = settings;
  for (const fieldId of fieldIds) {
    next = removeFieldLabelColorOverride(next, fieldId);
  }
  return next;
}

export function collectFieldIdsFromSchemas(schemas: CabinetFormSchemas): Set<string> {
  const ids = new Set<string>();
  for (const entity of Object.values(schemas)) {
    for (const field of flattenFieldsFromCategories(entity.categories)) {
      ids.add(field.id);
    }
  }
  return ids;
}

export function pruneFieldLabelColors(
  settings: CabinetDisplaySettings,
  validFieldIds: Set<string>,
): CabinetDisplaySettings {
  if (!settings.fieldLabelColors) {
    return settings;
  }

  const pruned: Record<string, string | null> = {};
  for (const [fieldId, color] of Object.entries(settings.fieldLabelColors)) {
    if (validFieldIds.has(fieldId) && color) {
      pruned[fieldId] = color;
    }
  }

  return {
    ...settings,
    fieldLabelColors: Object.keys(pruned).length > 0 ? pruned : undefined,
  };
}
