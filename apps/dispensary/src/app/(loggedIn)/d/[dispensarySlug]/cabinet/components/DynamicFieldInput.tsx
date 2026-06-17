'use client';

import { useCallback, useMemo } from 'react';
import {
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import type { CustomValues, FormField } from '@/lib/cabinet/formSchema';
import {
  collectFieldIdsToClearOnSelectChange,
  getVisibleFieldsForSelectValue,
} from '@/lib/cabinet/formSchema';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import { formatRpDate, parseRealDateFromIso } from '@/lib/rpCalendar';

type DynamicFieldInputProps = {
  field: FormField;
  value: string | null;
  onChange: (fieldId: string, value: string | null) => void;
  readOnly?: boolean;
  values: CustomValues;
  depth?: number;
};

function FieldRecursive({
  field,
  value,
  onChange,
  readOnly,
  values,
  depth = 0,
}: DynamicFieldInputProps) {
  const visibleChildren = useMemo(() => {
    if (field.type !== 'select') return [];
    return getVisibleFieldsForSelectValue(field, value);
  }, [field, value]);

  const handleSelectChange = useCallback(
    (nextValue: string | null) => {
      const idsToClear = collectFieldIdsToClearOnSelectChange(field, value, nextValue);
      for (const id of idsToClear) {
        onChange(id, null);
      }
      onChange(field.id, nextValue);
    },
    [field, value, onChange],
  );

  if (readOnly) {
    let display = value ?? '—';
    if (field.type === 'select' && value) {
      display = field.options?.find((o) => o.id === value)?.label ?? value;
    }
    if (field.type === 'date' && value) {
      const d = parseRealDateFromIso(value);
      display = formatRpDate(d);
    }
    return (
      <Stack gap="xs" pl={depth > 0 ? 'md' : 0}>
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
            depth={depth + 1}
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
          onChange={handleSelectChange}
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
    <Stack gap="xs" pl={depth > 0 ? 'md' : 0}>
      {input}
      {visibleChildren.map((child) => (
        <FieldRecursive
          key={child.id}
          field={child}
          value={values[child.id] ?? null}
          onChange={onChange}
          readOnly={readOnly}
          values={values}
          depth={depth + 1}
        />
      ))}
    </Stack>
  );
}

export function DynamicFieldInput(props: DynamicFieldInputProps) {
  return <FieldRecursive {...props} />;
}
