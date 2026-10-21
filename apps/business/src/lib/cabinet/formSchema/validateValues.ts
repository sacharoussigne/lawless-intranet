import type { CustomValues, FormEntitySchema, FormField } from './types';
import {
  getSelectedOptionIds,
  isMultiSelectField,
  parseMultiSelectValue,
  serializeSelectValue,
} from './selectValue';
import { getVisibleFieldsForSelectedOptions } from './flattenFields';
import { resolveStoredValue } from './resolveFieldValue';

export type ValidateValuesResult =
  | { ok: true; values: CustomValues }
  | { ok: false; fieldErrors: { fieldId: string; message: string }[] };

function isEmptyValue(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

export type ValidateCustomValuesOptions = {
  enforceRequired?: boolean;
};

function resolveStoredValueFromMap(
  values: CustomValues,
  field: FormField,
): string | null | undefined {
  return resolveStoredValue(values, field);
}

function validateFieldValue(
  field: FormField,
  value: string | null | undefined,
  enforceRequired: boolean,
): string | null {
  if (isEmptyValue(value)) {
    if (field.required && enforceRequired) {
      throw new Error(`Le champ « ${field.label} » est requis`);
    }
    return null;
  }

  const v = value!.trim();

  if (field.type === 'date') {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Date invalide pour « ${field.label} »`);
    }
    return d.toISOString();
  }

  if (field.type === 'select' && field.options?.length) {
    const validIds = new Set(field.options.map((o) => o.id));
    if (isMultiSelectField(field)) {
      const ids = parseMultiSelectValue(v);
      if (ids.length === 0) {
        if (field.required && enforceRequired) {
          throw new Error(`Le champ « ${field.label} » est requis`);
        }
        return null;
      }
      for (const id of ids) {
        if (!validIds.has(id)) {
          throw new Error(`Valeur invalide pour « ${field.label} »`);
        }
      }
      return serializeSelectValue(field, ids);
    }
    if (!validIds.has(v)) {
      throw new Error(`Valeur invalide pour « ${field.label} »`);
    }
  }

  return v;
}

function validateFieldsRecursive(
  fields: FormField[],
  values: CustomValues,
  result: CustomValues,
  enforceRequired: boolean,
  errors: { fieldId: string; message: string }[],
): void {
  for (const field of fields) {
    try {
      const raw = resolveStoredValueFromMap(values, field) ?? null;
      result[field.id] = validateFieldValue(field, raw, enforceRequired);

      if (field.type === 'select' && field.conditionalBranches?.length) {
        const stored = result[field.id];
        if (stored) {
          const selectedIds = getSelectedOptionIds(field, stored);
          const visible = getVisibleFieldsForSelectedOptions(field, selectedIds);
          validateFieldsRecursive(visible, values, result, enforceRequired, errors);
        }
      }
    } catch (err) {
      errors.push({
        fieldId: field.id,
        message: err instanceof Error ? err.message : 'Valeur invalide',
      });
    }
  }
}

export function validateCustomValues(
  schema: FormEntitySchema,
  values: unknown,
  options: ValidateCustomValuesOptions = {},
): ValidateValuesResult {
  const enforceRequired = options.enforceRequired ?? true;
  const input: CustomValues =
    values !== null && typeof values === 'object' && !Array.isArray(values)
      ? (values as CustomValues)
      : {};

  const result: CustomValues = {};
  const errors: { fieldId: string; message: string }[] = [];

  try {
    for (const category of schema.categories) {
      validateFieldsRecursive(category.fields, input, result, enforceRequired, errors);
    }
    if (errors.length > 0) {
      return { ok: false, fieldErrors: errors };
    }
    return { ok: true, values: result };
  } catch (err) {
    return {
      ok: false,
      fieldErrors: [
        {
          fieldId: '_form',
          message: err instanceof Error ? err.message : 'Valeurs invalides',
        },
      ],
    };
  }
}

export function parseCustomValuesFromDb(raw: unknown): CustomValues {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: CustomValues = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null) {
      result[key] = null;
    } else if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}
