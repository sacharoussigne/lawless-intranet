'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Collapse,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconTrash } from '@tabler/icons-react';
import type { FormField, FormFieldType } from '@/lib/cabinet/formSchema';
import { randomUUID } from '@/lib/randomId';
import { InlineEditableText } from './InlineEditableText';

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'textarea', label: 'Zone de texte' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste déroulante' },
];

type FormFieldSchemaRowProps = {
  field: FormField;
  onUpdate: (updates: Partial<Pick<FormField, 'label' | 'type' | 'required' | 'options'>>) => void;
  onDelete: () => void;
};

export function FormFieldSchemaRow({ field, onUpdate, onDelete }: FormFieldSchemaRowProps) {
  const [expanded, setExpanded] = useState(false);
  const optionsText = (field.options ?? []).map((o) => o.label).join('\n');

  return (
    <Stack
      gap="xs"
      p="sm"
      style={{
        border: '1px solid var(--mantine-color-slate-2)',
        borderRadius: 'var(--mantine-radius-sm)',
        background: 'var(--mantine-color-sage-0)',
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="center">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <ActionIcon
            variant="subtle"
            color="slate"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
          <InlineEditableText
            value={field.label}
            canEdit
            onSave={(label) => onUpdate({ label })}
            textClassName="disp-display-title"
          />
          <Text size="xs" c="dimmed">
            ({FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type})
            {field.required && ' *'}
          </Text>
        </Group>
        <ActionIcon variant="light" color="danger" size="sm" onClick={onDelete}>
          <IconTrash size={14} />
        </ActionIcon>
      </Group>

      <Collapse in={expanded}>
        <Stack gap="sm" pt="xs">
          <Select
            label="Type"
            size="xs"
            data={FIELD_TYPES}
            value={field.type}
            onChange={(v) => {
              const type = (v as FormFieldType) ?? 'text';
              if (type === 'select' && !field.options?.length) {
                onUpdate({
                  type,
                  options: [{ id: randomUUID(), label: 'Option 1' }],
                });
              } else {
                onUpdate({ type });
              }
            }}
          />
          <Switch
            label="Obligatoire"
            size="sm"
            checked={field.required}
            onChange={(e) => onUpdate({ required: e.currentTarget.checked })}
          />
          {field.type === 'select' && (
            <Textarea
              label="Options (une par ligne)"
              size="xs"
              minRows={3}
              defaultValue={optionsText}
              key={optionsText}
              onBlur={(e) => {
                const lines = e.currentTarget.value
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean);
                const existing = field.options ?? [];
                const options = lines.map((label, i) => ({
                  id: existing[i]?.id ?? randomUUID(),
                  label,
                }));
                onUpdate({ options });
              }}
            />
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}
