import { randomUUID } from '@/lib/randomId';
import type { FormField, FormFieldType } from './types';
import { reorderByOrder } from './reorderItems';
import {
  isMultiSelectField,
  normalizeSelectDefaultValue,
} from './selectValue';

export function mapFieldById(
  field: FormField,
  targetId: string,
  fn: (f: FormField) => FormField,
): FormField {
  if (field.id === targetId) return fn(field);
  if (!field.conditionalBranches) return field;
  return {
    ...field,
    conditionalBranches: field.conditionalBranches.map((branch) => ({
      ...branch,
      fields: mapFieldsById(branch.fields, targetId, fn),
    })),
  };
}

export function mapFieldsById(
  fields: FormField[],
  targetId: string,
  fn: (f: FormField) => FormField,
): FormField[] {
  return fields.map((f) => mapFieldById(f, targetId, fn));
}

export function deleteFieldById(root: FormField, targetId: string): FormField {
  if (!root.conditionalBranches) return root;
  return {
    ...root,
    conditionalBranches: root.conditionalBranches.map((branch) => ({
      ...branch,
      fields: deleteFromFields(branch.fields, targetId),
    })),
  };
}

export function deleteFromFields(fields: FormField[], targetId: string): FormField[] {
  return fields
    .filter((f) => f.id !== targetId)
    .map((f) => {
      if (!f.conditionalBranches) return f;
      return {
        ...f,
        conditionalBranches: f.conditionalBranches.map((branch) => ({
          ...branch,
          fields: deleteFromFields(branch.fields, targetId),
        })),
      };
    });
}

export function replaceTopLevelField(
  fields: FormField[],
  fieldId: string,
  replacement: FormField,
): FormField[] {
  return fields.map((f) => (f.id === fieldId ? replacement : f));
}

export function addFieldToBranch(
  field: FormField,
  optionId: string,
  partial: {
    label: string;
    type: FormFieldType;
    required: boolean;
    placeholder?: string;
    defaultValue?: string;
    editable?: boolean;
  },
): FormField {
  const branches = [...(field.conditionalBranches ?? [])];
  const branchIndex = branches.findIndex((b) => b.optionId === optionId);
  const branch =
    branchIndex >= 0
      ? branches[branchIndex]
      : { optionId, fields: [] as FormField[] };

  const maxOrder = branch.fields.reduce((m, f) => Math.max(m, f.order), -1);
  const newField: FormField = {
    id: randomUUID(),
    type: partial.type,
    label: partial.label.trim(),
    required: partial.required,
    order: maxOrder + 1,
  };
  if (partial.placeholder?.trim()) {
    newField.placeholder = partial.placeholder.trim();
  }
  if (partial.defaultValue?.trim()) {
    newField.defaultValue = partial.defaultValue.trim();
  }
  if (partial.editable === false) {
    newField.editable = false;
  }
  if (partial.type === 'select') {
    newField.options = [{ id: randomUUID(), label: 'Option 1' }];
  }

  const nextBranch = { ...branch, fields: [...branch.fields, newField] };
  const nextBranches =
    branchIndex >= 0
      ? branches.map((b, i) => (i === branchIndex ? nextBranch : b))
      : [...branches, nextBranch];

  return { ...field, conditionalBranches: nextBranches };
}

export function syncDefaultValueWithOptions(field: FormField): FormField {
  if (field.type !== 'select' || !field.defaultValue) return field;

  if (isMultiSelectField(field)) {
    const normalized = normalizeSelectDefaultValue(field);
    if (!normalized) {
      const next = { ...field };
      delete next.defaultValue;
      return next;
    }
    if (normalized === field.defaultValue) return field;
    return { ...field, defaultValue: normalized };
  }

  const valid = field.options?.some((o) => o.id === field.defaultValue);
  if (valid) return field;
  const next = { ...field };
  delete next.defaultValue;
  return next;
}

export function syncBranchesWithOptions(field: FormField): FormField {
  if (field.type !== 'select' || !field.options?.length) {
    const next = { ...field };
    delete next.conditionalBranches;
    delete next.defaultValue;
    return next;
  }
  const optionIds = new Set(field.options.map((o) => o.id));
  const branches = (field.conditionalBranches ?? []).filter((b) => optionIds.has(b.optionId));
  let next: FormField = {
    ...field,
    conditionalBranches: branches.length > 0 ? branches : undefined,
  };
  next = syncDefaultValueWithOptions(next);
  return next;
}

export function getBranchFields(field: FormField, optionId: string): FormField[] {
  return field.conditionalBranches?.find((b) => b.optionId === optionId)?.fields ?? [];
}

export function moveFieldInBranch(
  field: FormField,
  optionId: string,
  fieldId: string,
  direction: 'up' | 'down',
): FormField {
  if (!field.conditionalBranches) return field;
  return {
    ...field,
    conditionalBranches: field.conditionalBranches.map((branch) => {
      if (branch.optionId !== optionId) return branch;
      return {
        ...branch,
        fields: reorderByOrder(branch.fields, fieldId, direction),
      };
    }),
  };
}
