'use client';

import { useMemo } from 'react';
import {
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import type { CustomValues, FormField } from '@/lib/cabinet/formSchema';
import { getVisibleFieldsForSelectValue } from '@/lib/cabinet/formSchema';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import { formatRpDate, parseRealDateFromIso } from '@/lib/rpCalendar';

type DynamicFieldInputProps = {
  field: FormField;
  value: string | null;
  onChange: (fieldId: string, value: string | null) => void;
  readOnly?: boolean;
  values: CustomValues;
};

function FieldRecursive({
  field,
  value,
  onChange,
  readOnly,
  values,
}: DynamicFieldInputProps) {
  const visibleChildren = useMemo(() => {
    if (field.type !== 'select') return [];
    return getVisibleFieldsForSelectValue(field, value);
  }, [field, value]);

  if (readOnly) {
    let display = value ?? '—';
    if (field.type === 'date' && value) {
      const d = parseRealDateFromIso(value);
      display = formatRpDate(d);
    }
    return (
      <Stack gap="xs">
        <div>
          <Text size="sm" fw={500}>
            {field.label}
            {field.required && ' *'}
          </Text>
          <Text size="sm" c="dimmed">
            {display}
          </Text>
        </div>
        {visibleChildren.map((child) => (
          <FieldRecursive
            key={child.id}
            field={child}
            value={values[child.id] ?? null}
            onChange={onChange}
            readOnly
            values={values}
          />
        ))}
      </Stack>
    );
  }

  const common = {
    label: field.label,
    required: field.required,
    value: value ?? '',
  };

  let input: React.ReactNode;

  switch (field.type) {
    case 'textarea':
      input = (
        <Textarea
          {...common}
          minRows={3}
          onChange={(e) => onChange(field.id, e.currentTarget.value || null)}
        />
      );
      break;
    case 'date':
      input = (
        <RpDatePicker
          label={field.label}
          required={field.required}
          value={value}
          clearable={!field.required}
          onChange={(d) => onChange(field.id, d ? d.toISOString() : null)}
        />
      );
      break;
    case 'select':
      input = (
        <Select
          label={field.label}
          required={field.required}
          data={(field.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
          value={value}
          onChange={(v) => onChange(field.id, v)}
          clearable={!field.required}
        />
      );
      break;
    default:
      input = (
        <TextInput
          {...common}
          onChange={(e) => onChange(field.id, e.currentTarget.value || null)}
        />
      );
  }

  return (
    <Stack gap="xs">
      {input}
      {visibleChildren.map((child) => (
        <FieldRecursive
          key={child.id}
          field={child}
          value={values[child.id] ?? null}
          onChange={onChange}
          readOnly={readOnly}
          values={values}
        />
      ))}
    </Stack>
  );
}

export function DynamicFieldInput(props: DynamicFieldInputProps) {
  return <FieldRecursive {...props} />;
}
