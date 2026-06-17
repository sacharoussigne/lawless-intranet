import { randomUUID } from '@/lib/randomId';
import type {
  FormEntitySchema,
  FormField,
  FormFieldType,
} from './types';
import { replaceTopLevelField } from './fieldTreeMutations';

export function addCategory(schema: FormEntitySchema, name: string): FormEntitySchema {
  const maxOrder = schema.categories.reduce((m, c) => Math.max(m, c.order), -1);
  return {
    categories: [
      ...schema.categories,
      {
        id: randomUUID(),
        name: name.trim(),
        isSystem: false,
        order: maxOrder + 1,
        fields: [],
      },
    ],
  };
}

export function updateCategoryName(
  schema: FormEntitySchema,
  categoryId: string,
  name: string,
): FormEntitySchema {
  return {
    categories: schema.categories.map((c) =>
      c.id === categoryId && !c.isSystem ? { ...c, name: name.trim() } : c,
    ),
  };
}

export function deleteCategory(schema: FormEntitySchema, categoryId: string): FormEntitySchema {
  const category = schema.categories.find((c) => c.id === categoryId);
  if (!category || category.isSystem) return schema;
  return {
    categories: schema.categories.filter((c) => c.id !== categoryId),
  };
}

export function addField(
  schema: FormEntitySchema,
  categoryId: string,
  partial: { label: string; type: FormFieldType; required: boolean; options?: string[] },
): FormEntitySchema {
  return {
    categories: schema.categories.map((c) => {
      if (c.id !== categoryId) return c;
      const maxOrder = c.fields.reduce((m, f) => Math.max(m, f.order), -1);
      const field: FormField = {
        id: randomUUID(),
        type: partial.type,
        label: partial.label.trim(),
        required: partial.required,
        order: maxOrder + 1,
      };
      if (partial.type === 'select' && partial.options?.length) {
        field.options = partial.options
          .map((l) => l.trim())
          .filter(Boolean)
          .map((label) => ({ id: randomUUID(), label }));
      }
      return { ...c, fields: [...c.fields, field] };
    }),
  };
}

export function replaceField(
  schema: FormEntitySchema,
  categoryId: string,
  field: FormField,
): FormEntitySchema {
  return {
    categories: schema.categories.map((c) => {
      if (c.id !== categoryId) return c;
      return {
        ...c,
        fields: replaceTopLevelField(c.fields, field.id, field),
      };
    }),
  };
}

export function updateField(
  schema: FormEntitySchema,
  categoryId: string,
  fieldId: string,
  updates: Partial<Pick<FormField, 'label' | 'type' | 'required' | 'options' | 'conditionalBranches'>>,
): FormEntitySchema {
  return {
    categories: schema.categories.map((c) => {
      if (c.id !== categoryId) return c;
      return {
        ...c,
        fields: c.fields.map((f) => {
          if (f.id !== fieldId) return f;
          const next: FormField = { ...f, ...updates };
          if (updates.type && updates.type !== 'select') {
            delete next.options;
            delete next.conditionalBranches;
          }
          if (updates.type === 'select' && updates.options) {
            next.options = updates.options;
          }
          return next;
        }),
      };
    }),
  };
}

export function deleteField(
  schema: FormEntitySchema,
  categoryId: string,
  fieldId: string,
): FormEntitySchema {
  return {
    categories: schema.categories.map((c) =>
      c.id === categoryId
        ? { ...c, fields: c.fields.filter((f) => f.id !== fieldId) }
        : c,
    ),
  };
}
