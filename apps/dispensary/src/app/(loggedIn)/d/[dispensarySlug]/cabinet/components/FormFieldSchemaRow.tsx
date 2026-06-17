'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react';
import type { FormField, FormFieldType } from '@/lib/cabinet/formSchema';
import {
  addFieldToBranch,
  deleteFieldById,
  getBranchFields,
  mapFieldById,
  syncBranchesWithOptions,
} from '@/lib/cabinet/formSchema/fieldTreeMutations';
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
  depth?: number;
  onChange: (field: FormField) => void;
  onDelete?: () => void;
};

export function FormFieldSchemaRow({
  field,
  depth = 0,
  onChange,
  onDelete,
}: FormFieldSchemaRowProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const optionsText = (field.options ?? []).map((o) => o.label).join('\n');

  const patchField = (updates: Partial<FormField>) => {
    let next: FormField = { ...field, ...updates };
    if (updates.type && updates.type !== 'select') {
      delete next.options;
      delete next.conditionalBranches;
    }
    if (updates.options) {
      next = syncBranchesWithOptions(next);
    }
    onChange(next);
  };

  const updateNestedField = (targetId: string, updated: FormField) => {
    onChange(mapFieldById(field, targetId, () => updated));
  };

  const deleteNestedField = (targetId: string) => {
    onChange(deleteFieldById(field, targetId));
  };

  return (
    <Stack
      gap="xs"
      p="sm"
      style={{
        marginLeft: depth > 0 ? depth * 12 : 0,
        border: '1px solid var(--mantine-color-slate-2)',
        borderRadius: 'var(--mantine-radius-sm)',
        background: depth > 0 ? 'var(--mantine-color-slate-0)' : 'var(--mantine-color-sage-0)',
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
            onSave={(label) => patchField({ label })}
            textClassName="disp-display-title"
          />
          <Text size="xs" c="dimmed">
            ({FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type})
            {field.required && ' *'}
          </Text>
        </Group>
        {onDelete && (
          <ActionIcon variant="light" color="danger" size="sm" onClick={onDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        )}
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
                patchField({
                  type,
                  options: [{ id: randomUUID(), label: 'Option 1' }],
                });
              } else {
                patchField({ type });
              }
            }}
          />
          <Switch
            label="Obligatoire"
            size="sm"
            checked={field.required}
            onChange={(e) => patchField({ required: e.currentTarget.checked })}
          />
          {field.type === 'select' && (
            <>
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
                  patchField({ options });
                }}
              />

              <Stack gap="md" mt="xs">
                <Text size="sm" fw={500}>
                  Champs conditionnels
                </Text>
                <Text size="xs" c="dimmed">
                  Définissez ce qui s&apos;affiche selon la valeur sélectionnée.
                </Text>
                {(field.options ?? []).map((option) => (
                  <ConditionalBranchEditor
                    key={option.id}
                    optionLabel={option.label}
                    branchFields={getBranchFields(field, option.id)}
                    onAddField={(partial) =>
                      onChange(addFieldToBranch(field, option.id, partial))
                    }
                    onUpdateField={(targetId, updated) => updateNestedField(targetId, updated)}
                    onDeleteField={(targetId) => deleteNestedField(targetId)}
                    depth={depth + 1}
                  />
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}

type ConditionalBranchEditorProps = {
  optionLabel: string;
  branchFields: FormField[];
  onAddField: (partial: { label: string; type: FormFieldType; required: boolean }) => void;
  onUpdateField: (targetId: string, field: FormField) => void;
  onDeleteField: (targetId: string) => void;
  depth: number;
};

function ConditionalBranchEditor({
  optionLabel,
  branchFields,
  onAddField,
  onUpdateField,
  onDeleteField,
  depth,
}: ConditionalBranchEditorProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FormFieldType>('text');
  const [newRequired, setNewRequired] = useState(false);

  const sortedFields = [...branchFields].sort((a, b) => a.order - b.order);

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onAddField({
      label: newLabel.trim(),
      type: newType,
      required: newRequired,
    });
    setNewLabel('');
    setNewType('text');
    setNewRequired(false);
  };

  return (
    <Stack
      gap="sm"
      p="sm"
      style={{
        borderLeft: '3px solid var(--mantine-color-leather-4)',
        background: 'var(--mantine-color-sage-0)',
        borderRadius: 'var(--mantine-radius-sm)',
      }}
    >
      <Group gap="xs">
        <Text size="sm" fw={500}>
          Si
        </Text>
        <Badge variant="outline" color="leather" size="sm">
          {optionLabel}
        </Badge>
      </Group>

      <Stack gap="xs">
        {sortedFields.map((child) => (
          <FormFieldSchemaRow
            key={child.id}
            field={child}
            depth={depth}
            onChange={(updated) => onUpdateField(child.id, updated)}
            onDelete={() => onDeleteField(child.id)}
          />
        ))}
        {sortedFields.length === 0 && (
          <Text size="xs" c="dimmed">
            Aucun champ pour cette option
          </Text>
        )}
      </Stack>

      <Group align="flex-end" wrap="wrap">
        <TextInput
          label="Nouveau champ"
          placeholder="Libellé"
          size="xs"
          value={newLabel}
          onChange={(e) => setNewLabel(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 120 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Select
          label="Type"
          size="xs"
          data={FIELD_TYPES}
          value={newType}
          onChange={(v) => setNewType((v as FormFieldType) ?? 'text')}
          style={{ minWidth: 140 }}
        />
        <Switch
          label="Requis"
          size="xs"
          checked={newRequired}
          onChange={(e) => setNewRequired(e.currentTarget.checked)}
          mt="lg"
        />
        <Button
          size="xs"
          color="sage"
          leftSection={<IconPlus size={14} />}
          onClick={handleAdd}
          disabled={!newLabel.trim()}
        >
          Ajouter
        </Button>
      </Group>
    </Stack>
  );
}
