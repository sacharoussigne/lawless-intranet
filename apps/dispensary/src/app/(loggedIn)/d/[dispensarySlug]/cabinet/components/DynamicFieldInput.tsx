'use client';

import { memo, useCallback, useMemo, type KeyboardEvent } from 'react';
import {
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import type { CustomValues, FormField } from '@/lib/cabinet/formSchema';
import {
  collectFieldDefaultsToSeedOnSelectChange,
  collectFieldIdsToClearOnSelectChange,
  formatSelectDisplayLabels,
  getSelectedOptionIds,
  getVisibleFieldGroupsForSelectValue,
  getVisibleFieldsForSelectValue,
  resolveFieldInputValue,
  serializeSelectValue,
} from '@/lib/cabinet/formSchema';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import { MarkdownContent } from '@/app/_components/MarkdownContent';
import {
  restoreTextControlSelection,
  tryMarkdownShortcut,
} from '@/lib/markdown/markdownShortcuts';
import { isBlockMarkdown } from '@/lib/markdown/isBlockMarkdown';
import { formatRpDate, parseRealDateFromIso } from '@/lib/rpCalendar';

const READ_ONLY_TEXT_STYLE = {
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
} as const;

type DynamicFieldInputProps = {
  field: FormField;
  value: string | null | undefined;
  onChange: (fieldId: string, value: string | null) => void;
  onBatchChange?: (updates: Record<string, string | null>) => void;
  readOnly?: boolean;
  values: CustomValues;
  depth?: number;
  fieldErrors?: Record<string, string>;
};

const CONDITIONAL_GROUP_STYLE = {
  borderLeft: '2px solid var(--mantine-color-sage-4)',
  paddingLeft: 'var(--mantine-spacing-md)',
} as const;

function renderConditionalChildren(
  field: FormField,
  effectiveValue: string | null,
  props: Omit<DynamicFieldInputProps, 'field' | 'value'>,
) {
  const { onChange, onBatchChange, readOnly, values, depth = 0, fieldErrors } = props;

  if (field.type === 'select' && field.multiple) {
    const groups = getVisibleFieldGroupsForSelectValue(field, effectiveValue);
    if (groups.length > 0) {
      return groups.map((group) => (
        <Stack key={group.optionId} gap="xs" style={CONDITIONAL_GROUP_STYLE}>
          <Text size="sm" fw={600}>
            {group.optionLabel}
          </Text>
          {group.fields.map((child) => (
            <FieldRecursive
              key={child.id}
              field={child}
              value={values[child.id]}
              onChange={onChange}
              onBatchChange={onBatchChange}
              readOnly={readOnly}
              values={values}
              depth={depth + 1}
              fieldErrors={fieldErrors}
            />
          ))}
        </Stack>
      ));
    }
  }

  const visibleChildren =
    field.type === 'select' ? getVisibleFieldsForSelectValue(field, effectiveValue) : [];

  return visibleChildren.map((child) => (
    <FieldRecursive
      key={child.id}
      field={child}
      value={values[child.id]}
      onChange={onChange}
      onBatchChange={onBatchChange}
      readOnly={readOnly}
      values={values}
      depth={depth + 1}
      fieldErrors={fieldErrors}
    />
  ));
}

function fieldRendersConditionalChildren(field: FormField): boolean {
  return (
    field.type === 'select' &&
    (Boolean(field.conditionalBranches?.length) || field.multiple === true)
  );
}

function fieldInputPropsAreEqual(
  prev: DynamicFieldInputProps,
  next: DynamicFieldInputProps,
): boolean {
  if (fieldRendersConditionalChildren(prev.field)) {
    if (prev.values !== next.values) return false;
    if (prev.fieldErrors !== next.fieldErrors) return false;
  }

  return (
    prev.field === next.field &&
    prev.value === next.value &&
    prev.readOnly === next.readOnly &&
    prev.depth === next.depth &&
    prev.onChange === next.onChange &&
    prev.onBatchChange === next.onBatchChange &&
    prev.fieldErrors?.[prev.field.id] === next.fieldErrors?.[next.field.id]
  );
}

const FieldRecursive = memo(function FieldRecursive({
  field,
  value,
  onChange,
  onBatchChange,
  readOnly,
  values,
  depth = 0,
  fieldErrors,
}: DynamicFieldInputProps) {
  const effectiveValue = resolveFieldInputValue(value, field.defaultValue);
  const error = fieldErrors?.[field.id];
  const fieldLocked = readOnly || field.editable === false;

  const selectedOptionIds = useMemo(() => {
    if (field.type !== 'select') return [];
    return getSelectedOptionIds(field, effectiveValue);
  }, [field, effectiveValue]);

  const selectData = useMemo(
    () => (field.options ?? []).map((o) => ({ value: o.id, label: o.label })),
    [field.options],
  );

  const applySelectChange = useCallback(
    (nextStored: string | null) => {
      const previousEffective = resolveFieldInputValue(value, field.defaultValue);
      const idsToClear = collectFieldIdsToClearOnSelectChange(
        field,
        previousEffective,
        nextStored,
        values,
      );
      const defaultsToSeed = collectFieldDefaultsToSeedOnSelectChange(
        field,
        previousEffective,
        nextStored,
        values,
      );

      if (onBatchChange) {
        const updates: Record<string, string | null> = { [field.id]: nextStored };
        for (const id of idsToClear) {
          updates[id] = null;
        }
        for (const { fieldId, defaultValue } of defaultsToSeed) {
          updates[fieldId] = defaultValue;
        }
        onBatchChange(updates);
        return;
      }

      for (const id of idsToClear) {
        onChange(id, null);
      }
      onChange(field.id, nextStored);
      for (const { fieldId, defaultValue } of defaultsToSeed) {
        onChange(fieldId, defaultValue);
      }
    },
    [field, value, values, onChange, onBatchChange],
  );

  const handleSelectChange = useCallback(
    (nextValue: string | null) => {
      applySelectChange(nextValue);
    },
    [applySelectChange],
  );

  const handleMultiSelectChange = useCallback(
    (nextIds: string[]) => {
      applySelectChange(serializeSelectValue(field, nextIds));
    },
    [applySelectChange, field],
  );

  const handleMarkdownKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const result = tryMarkdownShortcut(e);
      if (!result) return;

      e.preventDefault();
      const element = e.currentTarget;
      onChange(field.id, result.value || null);
      restoreTextControlSelection(element, result);
    },
    [field.id, onChange],
  );

  if (fieldLocked) {
    let display = effectiveValue ?? '—';
    if (field.type === 'select') {
      display = formatSelectDisplayLabels(field, effectiveValue);
    }
    if (field.type === 'date' && effectiveValue) {
      const d = parseRealDateFromIso(effectiveValue);
      display = formatRpDate(d);
    }

    const label = (
      <Text size="sm" component="span">
        <strong>
          {field.label}
          {field.required && !readOnly && ' *'} :
        </strong>
      </Text>
    );

    const usesMarkdown = field.type === 'text' || field.type === 'textarea';
    const isEmpty = effectiveValue == null || effectiveValue === '';
    const markdownIsBlock = !isEmpty && isBlockMarkdown(effectiveValue);

    const readOnlyContent = usesMarkdown ? (
      markdownIsBlock ? (
        <Stack gap={4} style={{ minWidth: 0 }}>
          {label}
          <MarkdownContent source={effectiveValue} />
        </Stack>
      ) : (
        <Text size="sm" component="div" style={READ_ONLY_TEXT_STYLE}>
          {label}{' '}
          {isEmpty ? (
            '—'
          ) : (
            <MarkdownContent inline source={effectiveValue} />
          )}
        </Text>
      )
    ) : (
      <Text size="sm" style={READ_ONLY_TEXT_STYLE}>
        {label} {display}
      </Text>
    );

    return (
      <Stack gap="xs" pl={depth > 0 ? 'md' : 0} style={{ minWidth: 0 }}>
        {readOnlyContent}
        {renderConditionalChildren(field, effectiveValue, {
          onChange,
          onBatchChange,
          readOnly,
          values,
          depth,
          fieldErrors,
        })}
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
          autosize
          minRows={3}
          resize="vertical"
          onKeyDown={handleMarkdownKeyDown}
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
      input = field.multiple ? (
        <MultiSelect
          label={field.label}
          required={field.required}
          placeholder={field.placeholder}
          error={error}
          data={selectData}
          value={selectedOptionIds}
          onChange={handleMultiSelectChange}
          clearable={!field.required}
        />
      ) : (
        <Select
          label={field.label}
          required={field.required}
          placeholder={field.placeholder}
          error={error}
          data={selectData}
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
          onKeyDown={handleMarkdownKeyDown}
          onChange={(e) => onChange(field.id, e.currentTarget.value || null)}
        />
      );
  }

  return (
    <Stack gap="xs" pl={depth > 0 ? 'md' : 0}>
      {input}
      {renderConditionalChildren(field, effectiveValue, {
        onChange,
        onBatchChange,
        readOnly,
        values,
        depth,
        fieldErrors,
      })}
    </Stack>
  );
}, fieldInputPropsAreEqual);

export const DynamicFieldInput = memo(function DynamicFieldInput(props: DynamicFieldInputProps) {
  return <FieldRecursive {...props} />;
}, fieldInputPropsAreEqual);
