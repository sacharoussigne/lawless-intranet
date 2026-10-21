import type { FormFieldType } from '@/lib/cabinet/formSchema';
import { DEFAULT_LABEL_COLOR } from './constants';
import type { CabinetDisplaySettings, CabinetLabelColorKey } from './types';

export function resolveLabelColor(
  labelKey: CabinetLabelColorKey,
  settings: CabinetDisplaySettings,
  fieldId?: string,
): string {
  if (fieldId) {
    const fieldOverride = settings.fieldLabelColors?.[fieldId];
    if (fieldOverride) {
      return fieldOverride;
    }
  }

  const typeColor = settings.labelColors?.[labelKey];
  if (typeColor) {
    return typeColor;
  }

  return DEFAULT_LABEL_COLOR;
}

export function resolveFieldLabelColor(
  fieldType: FormFieldType,
  settings: CabinetDisplaySettings,
  fieldId?: string,
): string {
  return resolveLabelColor(fieldType, settings, fieldId);
}

export function getMantineLabelStyles(
  labelKey: CabinetLabelColorKey,
  settings: CabinetDisplaySettings,
  fieldId?: string,
): { label: { color: string; fontWeight: number } } {
  return {
    label: {
      color: resolveLabelColor(labelKey, settings, fieldId),
      fontWeight: 700,
    },
  };
}
