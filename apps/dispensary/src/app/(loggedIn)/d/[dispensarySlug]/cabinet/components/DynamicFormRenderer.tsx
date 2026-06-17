'use client';

import { Stack } from '@mantine/core';
import type { CustomValues, FormEntitySchema } from '@/lib/cabinet/formSchema';
import { FormCategoryCard } from './FormCategoryCard';

type DynamicFormRendererProps = {
  schema: FormEntitySchema;
  values: CustomValues;
  onChange: (fieldId: string, value: string | null) => void;
  readOnly?: boolean;
  systemCards?: Record<string, React.ReactNode>;
};

export function DynamicFormRenderer({
  schema,
  values,
  onChange,
  readOnly,
  systemCards,
}: DynamicFormRendererProps) {
  const sortedCategories = [...schema.categories].sort((a, b) => a.order - b.order);

  return (
    <Stack gap="md">
      {sortedCategories.map((category) => (
        <FormCategoryCard
          key={category.id}
          category={category}
          values={values}
          onChange={onChange}
          readOnly={readOnly}
        >
          {category.systemKey && systemCards?.[category.systemKey]}
        </FormCategoryCard>
      ))}
    </Stack>
  );
}
