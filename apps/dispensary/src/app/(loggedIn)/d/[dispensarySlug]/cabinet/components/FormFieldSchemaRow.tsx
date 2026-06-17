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
  moveFieldInBranch,
  syncBranchesWithOptions,
} from '@/lib/cabinet/formSchema/fieldTreeMutations';
import { randomUUID } from '@/lib/randomId';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import { InlineEditableText } from './InlineEditableText';
import { SchemaReorderButtons } from './SchemaReorderButtons';

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
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: 'up' | 'down') => void;
};

export function FormFieldSchemaRow({
  field,
  depth = 0,
  onChange,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
  onMove,
}: FormFieldSchemaRowProps) {
  const [expanded, setExpanded] = useState(false);
  const optionsText = (field.options ?? []).map((o) => o.label).join('\n');

  const patchField = (updates: Partial<FormField>) => {
    let next: FormField = { ...field, ...updates };
    if (updates.placeholder === '') delete next.placeholder;
    if (updates.defaultValue === '') delete next.defaultValue;
    if ('editable' in updates && updates.editable !== false) delete next.editable;
    if (updates.defaultValue === '' || updates.defaultValue === undefined) {
      if (!next.defaultValue && next.editable === false) delete next.editable;
    }
    if (updates.type && updates.type !== 'select') {
      delete next.options;
      delete next.conditionalBranches;
      if (field.type === 'select') {
        delete next.defaultValue;
      }
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
          {field.editable === false && (
            <Badge variant="outline" color="slate" size="xs">
              Fixe
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          {onMove && (
            <SchemaReorderButtons
              size="xs"
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onMove={onMove}
            />
          )}
          {onDelete && (
            <ActionIcon variant="light" color="danger" size="sm" onClick={onDelete}>
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      <Collapse in={expanded}>
        <Stack gap="sm" pt="xs">
          <Group align="flex-end" wrap="wrap" grow>
            <Select
              label="Type"
              size="xs"
              data={FIELD_TYPES}
              value={field.type}
              style={{ flex: 1, minWidth: 140 }}
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
            {(field.type === 'text' ||
              field.type === 'textarea' ||
              field.type === 'select' ||
              field.type === 'date') && (
              <TextInput
                label="Placeholder"
                size="xs"
                placeholder="Texte d'aide"
                value={field.placeholder ?? ''}
                style={{ flex: 1, minWidth: 160 }}
                onChange={(e) => patchField({ placeholder: e.currentTarget.value })}
              />
            )}
            {field.type === 'text' || field.type === 'textarea' ? (
              <TextInput
                label="Valeur par défaut"
                size="xs"
                value={field.defaultValue ?? ''}
                style={{ flex: 1, minWidth: 160 }}
                onChange={(e) => patchField({ defaultValue: e.currentTarget.value })}
              />
            ) : field.type === 'select' ? (
              <Select
                label="Valeur par défaut"
                size="xs"
                placeholder="Aucune"
                data={(field.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
                value={field.defaultValue ?? null}
                clearable
                style={{ flex: 1, minWidth: 160 }}
                onChange={(v) => patchField({ defaultValue: v ?? '' })}
              />
            ) : field.type === 'date' ? (
              <div style={{ flex: 1, minWidth: 180 }}>
                <RpDatePicker
                  label="Valeur par défaut"
                  value={field.defaultValue ?? null}
                  clearable
                  onChange={(d) => patchField({ defaultValue: d ? d.toISOString() : '' })}
                />
              </div>
            ) : null}
          </Group>
          <Group gap="lg">
            <Switch
              label="Obligatoire"
              size="sm"
              checked={field.required}
              onChange={(e) => patchField({ required: e.currentTarget.checked })}
            />
            {field.defaultValue && (
              <Switch
                label="Modifiable"
                size="sm"
                checked={field.editable !== false}
                onChange={(e) => patchField({ editable: e.currentTarget.checked })}
              />
            )}
          </Group>
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
                    onMoveField={(targetId, direction) =>
                      onChange(moveFieldInBranch(field, option.id, targetId, direction))
                    }
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
  onAddField: (partial: {
    label: string;
    type: FormFieldType;
    required: boolean;
    placeholder?: string;
    defaultValue?: string;
    editable?: boolean;
  }) => void;
  onUpdateField: (targetId: string, field: FormField) => void;
  onDeleteField: (targetId: string) => void;
  onMoveField: (targetId: string, direction: 'up' | 'down') => void;
  depth: number;
};

function ConditionalBranchEditor({
  optionLabel,
  branchFields,
  onAddField,
  onUpdateField,
  onDeleteField,
  onMoveField,
  depth,
}: ConditionalBranchEditorProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FormFieldType>('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [newDefaultValue, setNewDefaultValue] = useState('');
  const [newEditable, setNewEditable] = useState(true);

  const sortedFields = [...branchFields].sort((a, b) => a.order - b.order);

  const resetAddForm = () => {
    setNewLabel('');
    setNewType('text');
    setNewRequired(false);
    setNewPlaceholder('');
    setNewDefaultValue('');
    setNewEditable(true);
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onAddField({
      label: newLabel.trim(),
      type: newType,
      required: newRequired,
      placeholder: newPlaceholder.trim() || undefined,
      defaultValue: newDefaultValue.trim() || undefined,
      editable: newDefaultValue.trim() ? newEditable : undefined,
    });
    resetAddForm();
  };

  const showPlaceholder =
    newType === 'text' || newType === 'textarea' || newType === 'select' || newType === 'date';

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
        {sortedFields.map((child, index) => (
          <FormFieldSchemaRow
            key={child.id}
            field={child}
            depth={depth}
            onChange={(updated) => onUpdateField(child.id, updated)}
            onDelete={() => onDeleteField(child.id)}
            canMoveUp={index > 0}
            canMoveDown={index < sortedFields.length - 1}
            onMove={(direction) => onMoveField(child.id, direction)}
          />
        ))}
        {sortedFields.length === 0 && (
          <Text size="xs" c="dimmed">
            Aucun champ pour cette option
          </Text>
        )}
      </Stack>

      <Group align="flex-end" wrap="wrap" grow>
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
          style={{ flex: 1, minWidth: 140 }}
        />
        {showPlaceholder && (
          <TextInput
            label="Placeholder"
            size="xs"
            placeholder="Texte d'aide"
            value={newPlaceholder}
            onChange={(e) => setNewPlaceholder(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 140 }}
          />
        )}
        {(newType === 'text' || newType === 'textarea') && (
          <TextInput
            label="Valeur par défaut"
            size="xs"
            value={newDefaultValue}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setNewDefaultValue(value);
              if (!value.trim()) setNewEditable(true);
            }}
            style={{ flex: 1, minWidth: 140 }}
          />
        )}
        {newType === 'date' && (
          <div style={{ flex: 1, minWidth: 180 }}>
            <RpDatePicker
              label="Valeur par défaut"
              value={newDefaultValue || null}
              clearable
              onChange={(d) => {
                const iso = d ? d.toISOString() : '';
                setNewDefaultValue(iso);
                if (!iso) setNewEditable(true);
              }}
            />
          </div>
        )}
        {newDefaultValue && (
          <Switch
            label="Modifiable"
            size="xs"
            checked={newEditable}
            onChange={(e) => setNewEditable(e.currentTarget.checked)}
            mt="lg"
          />
        )}
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
