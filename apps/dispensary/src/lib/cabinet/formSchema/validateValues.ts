import type { CustomValues, FormEntitySchema, FormField } from './types';

export type ValidateValuesResult =
  | { ok: true; values: CustomValues }
  | { ok: false; error: string };

function isEmptyValue(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

export type ValidateCustomValuesOptions = {
  enforceRequired?: boolean;
};

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
): void {
  for (const field of fields) {
    const raw = values[field.id] ?? null;
    result[field.id] = validateFieldValue(field, raw, enforceRequired);

    if (field.type === 'select' && field.conditionalBranches?.length) {
      const selectedId = result[field.id];
      if (selectedId) {
        const branch = field.conditionalBranches.find((b) => b.optionId === selectedId);
        if (branch) {
          validateFieldsRecursive(branch.fields, values, result, enforceRequired);
        }
      }
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

  try {
    for (const category of schema.categories) {
      validateFieldsRecursive(category.fields, input, result, enforceRequired);
    }
    return { ok: true, values: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Valeurs invalides',
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
