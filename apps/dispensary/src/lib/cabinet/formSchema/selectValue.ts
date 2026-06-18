import type { FormField } from './types';

export function isMultiSelectField(field: FormField): boolean {
  return field.type === 'select' && field.multiple === true;
}

export function parseMultiSelectValue(stored: string): string[] {
  if (!stored.trim()) return [];
  if (stored.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
      }
    } catch {
      return [];
    }
  }
  return [stored];
}

export function getSelectedOptionIds(
  field: FormField,
  stored: string | null | undefined,
): string[] {
  if (!stored) return [];
  if (isMultiSelectField(field)) return parseMultiSelectValue(stored);
  return [stored];
}

export function serializeSelectValue(
  field: FormField,
  value: string | string[] | null,
): string | null {
  if (value === null) return null;
  if (!isMultiSelectField(field)) {
    const single = Array.isArray(value) ? value[0] : value;
    return single?.trim() ? single.trim() : null;
  }
  const ids = [...new Set((Array.isArray(value) ? value : [value]).filter(Boolean))];
  if (ids.length === 0) return null;
  return JSON.stringify(ids);
}

export function formatSelectDisplayLabels(
  field: FormField,
  stored: string | null | undefined,
): string {
  if (!stored) return '—';
  const optionMap = new Map((field.options ?? []).map((o) => [o.id, o.label]));
  const ids = getSelectedOptionIds(field, stored);
  if (ids.length === 0) return '—';
  return ids.map((id) => optionMap.get(id) ?? id).join(', ');
}

export function areSelectStoredValuesEqual(
  field: FormField,
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a === b) return true;
  if (field.type !== 'select') return false;
  const idsA = getSelectedOptionIds(field, a ?? null).sort().join('\0');
  const idsB = getSelectedOptionIds(field, b ?? null).sort().join('\0');
  return idsA === idsB;
}

export function normalizeSelectDefaultValue(field: FormField): string | undefined {
  if (!field.defaultValue?.trim()) return undefined;
  if (!isMultiSelectField(field)) return field.defaultValue.trim();

  const validIds = new Set((field.options ?? []).map((o) => o.id));
  const ids = parseMultiSelectValue(field.defaultValue).filter((id) => validIds.has(id));
  if (ids.length === 0) return undefined;
  return JSON.stringify(ids);
}

export function convertSelectDefaultForMultipleChange(
  defaultValue: string | undefined,
  enableMultiple: boolean,
): string | undefined {
  if (!defaultValue?.trim()) return undefined;
  if (enableMultiple) {
    if (defaultValue.startsWith('[')) return defaultValue;
    return JSON.stringify([defaultValue]);
  }
  if (defaultValue.startsWith('[')) {
    const first = parseMultiSelectValue(defaultValue)[0];
    return first;
  }
  return defaultValue;
}
