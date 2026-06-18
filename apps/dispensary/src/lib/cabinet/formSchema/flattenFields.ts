import type { CustomValues, FormField } from './types';
import { resolveFieldInputValue } from './resolveFieldValue';
import { getSelectedOptionIds } from './selectValue';

export function flattenFields(fields: FormField[]): FormField[] {
  const result: FormField[] = [];

  for (const field of fields) {
    result.push(field);
    if (field.conditionalBranches) {
      for (const branch of field.conditionalBranches) {
        result.push(...flattenFields(branch.fields));
      }
    }
  }

  return result;
}

export function flattenFieldsFromCategories(
  categories: { fields: FormField[] }[],
): FormField[] {
  return categories.flatMap((c) => flattenFields(c.fields));
}

export function getVisibleFieldsForSelectedOptions(
  field: FormField,
  selectedOptionIds: string[],
): FormField[] {
  if (!field.conditionalBranches?.length || selectedOptionIds.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: FormField[] = [];

  for (const optionId of selectedOptionIds) {
    const branch = field.conditionalBranches.find((b) => b.optionId === optionId);
    if (!branch) continue;
    for (const child of branch.fields) {
      if (!seen.has(child.id)) {
        seen.add(child.id);
        result.push(child);
      }
    }
  }

  return result.sort((a, b) => a.order - b.order);
}

export function getVisibleFieldsForSelectValue(
  field: FormField,
  selectedValue: string | null | undefined,
): FormField[] {
  const selectedIds = getSelectedOptionIds(field, selectedValue ?? null);
  return getVisibleFieldsForSelectedOptions(field, selectedIds);
}

export type SelectBranchFieldGroup = {
  optionId: string;
  optionLabel: string;
  fields: FormField[];
};

export function getVisibleFieldGroupsForSelectValue(
  field: FormField,
  selectedValue: string | null | undefined,
): SelectBranchFieldGroup[] {
  if (field.type !== 'select' || !field.multiple) return [];

  const selectedIds = getSelectedOptionIds(field, selectedValue ?? null);
  if (selectedIds.length === 0) return [];

  const optionMap = new Map((field.options ?? []).map((o) => [o.id, o.label]));
  const groups: SelectBranchFieldGroup[] = [];

  for (const optionId of selectedIds) {
    const branch = field.conditionalBranches?.find((b) => b.optionId === optionId);
    if (!branch?.fields.length) continue;
    groups.push({
      optionId,
      optionLabel: optionMap.get(optionId) ?? optionId,
      fields: [...branch.fields].sort((a, b) => a.order - b.order),
    });
  }

  return groups;
}

function collectVisibleFieldTree(roots: FormField[], values: CustomValues): FormField[] {
  const result: FormField[] = [];

  const walk = (fields: FormField[]) => {
    for (const field of fields) {
      result.push(field);
      if (field.type === 'select' && field.conditionalBranches?.length) {
        const effective = resolveFieldInputValue(values[field.id], field.defaultValue);
        const children = getVisibleFieldsForSelectValue(field, effective);
        walk(children);
      }
    }
  };

  walk(roots);
  return result;
}

export function collectFieldIdsToClearOnSelectChange(
  field: FormField,
  previousValue: string | null,
  nextValue: string | null,
  values: CustomValues,
): string[] {
  if (field.type !== 'select') return [];

  const prevRoots = getVisibleFieldsForSelectedOptions(
    field,
    getSelectedOptionIds(field, previousValue),
  );
  const nextRoots = getVisibleFieldsForSelectedOptions(
    field,
    getSelectedOptionIds(field, nextValue),
  );

  const prevIds = new Set(collectVisibleFieldTree(prevRoots, values).map((f) => f.id));
  const nextIds = new Set(collectVisibleFieldTree(nextRoots, values).map((f) => f.id));

  return [...prevIds].filter((id) => !nextIds.has(id));
}

export type FieldDefaultSeed = { fieldId: string; defaultValue: string };

export function collectFieldDefaultsToSeedOnSelectChange(
  field: FormField,
  previousValue: string | null,
  nextValue: string | null,
  values: CustomValues,
): FieldDefaultSeed[] {
  if (field.type !== 'select') return [];

  const prevRoots = getVisibleFieldsForSelectedOptions(
    field,
    getSelectedOptionIds(field, previousValue),
  );
  const nextRoots = getVisibleFieldsForSelectedOptions(
    field,
    getSelectedOptionIds(field, nextValue),
  );

  const prevIds = new Set(collectVisibleFieldTree(prevRoots, values).map((f) => f.id));
  const mergedValues: CustomValues = { ...values };
  const toSeed: FieldDefaultSeed[] = [];

  const walk = (fields: FormField[]) => {
    for (const f of fields) {
      if (!prevIds.has(f.id)) {
        const stored = mergedValues[f.id];
        if ((stored === undefined || stored === null) && f.defaultValue?.trim()) {
          const defaultValue = f.defaultValue.trim();
          toSeed.push({ fieldId: f.id, defaultValue });
          mergedValues[f.id] = defaultValue;
        }
      }
      if (f.type === 'select' && f.conditionalBranches?.length) {
        const effective = resolveFieldInputValue(mergedValues[f.id], f.defaultValue);
        walk(getVisibleFieldsForSelectValue(f, effective));
      }
    }
  };

  walk(nextRoots);
  return toSeed;
}
