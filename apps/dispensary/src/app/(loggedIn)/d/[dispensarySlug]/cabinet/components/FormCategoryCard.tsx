'use client';

import { Card, Stack, Text, Title } from '@mantine/core';
import type { CustomValues, FormCategory } from '@/lib/cabinet/formSchema';
import { DynamicFieldInput } from './DynamicFieldInput';

type FormCategoryCardProps = {
  category: FormCategory;
  values: CustomValues;
  onChange: (fieldId: string, value: string | null) => void;
  readOnly?: boolean;
  children?: React.ReactNode;
};

export function FormCategoryCard({
  category,
  values,
  onChange,
  readOnly,
  children,
}: FormCategoryCardProps) {
  const sortedFields = [...category.fields].sort((a, b) => a.order - b.order);

  return (
    <Card withBorder radius="sm" padding="md">
      <Title order={4} className="disp-display-title" mb="md">
        {category.name}
      </Title>
      <Stack gap="md">
        {children}
        {sortedFields.map((field) => (
          <DynamicFieldInput
            key={field.id}
            field={field}
            value={values[field.id] ?? null}
            onChange={onChange}
            readOnly={readOnly}
            values={values}
          />
        ))}
        {sortedFields.length === 0 && !children && (
          <Text size="sm" c="dimmed">
            Aucun champ personnalisé
          </Text>
        )}
      </Stack>
    </Card>
  );
}
