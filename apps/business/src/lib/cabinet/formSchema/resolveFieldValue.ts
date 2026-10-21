import type { CustomValues, FormField } from './types';

export function resolveFieldInputValue(
  stored: string | null | undefined,
  defaultValue?: string,
): string | null {
  if (stored !== undefined) return stored;
  return defaultValue ?? null;
}

export function resolveStoredValue(
  values: CustomValues,
  field: FormField,
): string | null | undefined {
  if (field.id in values) return values[field.id];
  return field.defaultValue;
}
