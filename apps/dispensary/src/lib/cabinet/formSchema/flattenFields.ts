import type { FormField } from './types';

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

export function getVisibleFieldsForSelectValue(
  field: FormField,
  selectedOptionId: string | null | undefined,
): FormField[] {
  if (!field.conditionalBranches || !selectedOptionId) {
    return [];
  }

  const branch = field.conditionalBranches.find((b) => b.optionId === selectedOptionId);
  return branch?.fields ?? [];
}
