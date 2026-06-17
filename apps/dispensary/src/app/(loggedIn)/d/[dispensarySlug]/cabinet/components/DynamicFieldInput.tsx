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
  resolveFieldInputValue,
} from '@/lib/cabinet/formSchema';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import { formatRpDate, parseRealDateFromIso } from '@/lib/rpCalendar';

type DynamicFieldInputProps = {
  field: FormField;
  value: string | null | undefined;
  onChange: (fieldId: string, value: string | null) => void;
  readOnly?: boolean;
  values: CustomValues;
  depth?: number;
  fieldErrors?: Record<string, string>;
};

function FieldRecursive({
  field,
  value,
  onChange,
  readOnly,
  values,
  depth = 0,
  fieldErrors,
}: DynamicFieldInputProps) {
  const effectiveValue = resolveFieldInputValue(value, field.defaultValue);
  const error = fieldErrors?.[field.id];
  const fieldLocked = readOnly || field.editable === false;

  const visibleChildren = useMemo(() => {
    if (field.type !== 'select') return [];
    return getVisibleFieldsForSelectValue(field, effectiveValue);
  }, [field, effectiveValue]);

  const handleSelectChange = useCallback(
    (nextValue: string | null) => {
      const idsToClear = collectFieldIdsToClearOnSelectChange(field, effectiveValue, nextValue);
      for (const id of idsToClear) {
        onChange(id, null);
      }
      onChange(field.id, nextValue);
    },
    [field, effectiveValue, onChange],
  );

  if (fieldLocked) {
    let display = effectiveValue ?? '—';
    if (field.type === 'select' && effectiveValue) {
      display = field.options?.find((o) => o.id === effectiveValue)?.label ?? effectiveValue;
    }
    if (field.type === 'date' && effectiveValue) {
      const d = parseRealDateFromIso(effectiveValue);
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
            value={values[child.id]}
            onChange={onChange}
            readOnly={readOnly}
            values={values}
            depth={depth + 1}
            fieldErrors={fieldErrors}
          />
        ))}
      </Stack>
    );
  }

  const common = {
    label: field.label,
    required: field.required,
    placeholder: field.placeholder,
    value: effectiveValue ?? '',
  };

  let input: React.ReactNode;

  switch (field.type) {
    case 'textarea':
      input = (
        <Textarea
          {...common}
          error={error}
          minRows={3}
          resize="vertical"
          onChange={(e) => onChange(field.id, e.currentTarget.value || null)}
        />
      );
      break;
    case 'date':
      input = (
        <RpDatePicker
          label={field.label}
          required={field.required}
          placeholder={field.placeholder}
          error={error}
          value={effectiveValue}
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
          placeholder={field.placeholder}
          error={error}
          data={(field.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
          value={effectiveValue}
          onChange={handleSelectChange}
          clearable={!field.required}
        />
      );
      break;
    default:
      input = (
        <TextInput
          {...common}
          error={error}
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
          value={values[child.id]}
          onChange={onChange}
          readOnly={readOnly}
          values={values}
          depth={depth + 1}
          fieldErrors={fieldErrors}
        />
      ))}
    </Stack>
  );
}

export function DynamicFieldInput(props: DynamicFieldInputProps) {
  return <FieldRecursive {...props} />;
}
