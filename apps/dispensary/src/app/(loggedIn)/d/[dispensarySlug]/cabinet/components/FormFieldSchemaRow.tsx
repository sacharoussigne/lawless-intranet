'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Group,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react';
import type { FormField, FormFieldType } from '@/lib/cabinet/formSchema';
import { FIELD_TYPES } from '@/lib/cabinet/formSchema';
import {
  addFieldToBranch,
  deleteFieldById,
  getBranchFields,
  mapFieldById,
  moveFieldInBranch,
  syncBranchesWithOptions,
} from '@/lib/cabinet/formSchema/fieldTreeMutations';
import {
  convertSelectDefaultForMultipleChange,
  parseMultiSelectValue,
} from '@/lib/cabinet/formSchema';
import { randomUUID } from '@/lib/randomId';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import { InlineEditableText } from './InlineEditableText';
import { SchemaReorderButtons } from './SchemaReorderButtons';

type FormFieldSchemaRowProps = {
  field: FormField;
  depth?: number;
  onChange: (field: FormField) => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: 'up' | 'down') => void;
};

function normalizePatchedField(base: FormField, updates: Partial<FormField>): FormField {
  let next: FormField = { ...base, ...updates };
  if (updates.placeholder === '') delete next.placeholder;
  if (updates.defaultValue === '') delete next.defaultValue;
  if ('editable' in updates && updates.editable !== false) delete next.editable;
  if (updates.defaultValue === '' || updates.defaultValue === undefined) {
    if (!next.defaultValue && next.editable === false) delete next.editable;
  }
  if (updates.type && updates.type !== 'select') {
    delete next.options;
    delete next.conditionalBranches;
    delete next.multiple;
    if (base.type === 'select') {
      delete next.defaultValue;
    }
  }
  if ('multiple' in updates) {
    if (updates.multiple) {
      next.multiple = true;
      if (next.defaultValue) {
        const converted = convertSelectDefaultForMultipleChange(next.defaultValue, true);
        if (converted) next.defaultValue = converted;
        else delete next.defaultValue;
      }
    } else {
      delete next.multiple;
      if (next.defaultValue) {
        const converted = convertSelectDefaultForMultipleChange(next.defaultValue, false);
        if (converted) next.defaultValue = converted;
        else delete next.defaultValue;
      }
    }
  }
  if (updates.options) {
    next = syncBranchesWithOptions(next);
  }
  return next;
}

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
  const [draftField, setDraftField] = useState(field);
  const optionsText = (draftField.options ?? []).map((o) => o.label).join('\n');

  useEffect(() => {
    setDraftField(field);
  }, [field]);

  const commitField = useCallback(
    (next: FormField) => {
      setDraftField(next);
      onChange(next);
    },
    [onChange],
  );

  const patchField = useCallback(
    (updates: Partial<FormField>, commit = true) => {
      setDraftField((prev) => {
        const next = normalizePatchedField(prev, updates);
        if (commit) onChange(next);
        return next;
      });
    },
    [onChange],
  );

  const commitDraft = useCallback(() => {
    setDraftField((current) => {
      onChange(current);
      return current;
    });
  }, [onChange]);

  const updateNestedField = (targetId: string, updated: FormField) => {
    commitField(mapFieldById(draftField, targetId, () => updated));
  };

  const deleteNestedField = (targetId: string) => {
    commitField(deleteFieldById(draftField, targetId));
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
            value={draftField.label}
            canEdit
            onSave={(label) => patchField({ label })}
            textClassName="disp-display-title"
          />
          <Text size="xs" c="dimmed">
            ({FIELD_TYPES.find((t) => t.value === draftField.type)?.label ?? draftField.type})
            {draftField.required && ' *'}
          </Text>
          {draftField.editable === false && (
            <Badge variant="outline" color="slate" size="xs">
              Fixe
            </Badge>
          )}
          {draftField.type === 'select' && draftField.multiple && (
            <Badge variant="outline" color="sage" size="xs">
              Multi
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
              value={draftField.type}
              style={{ flex: 1, minWidth: 140 }}
              onChange={(v) => {
                const type = (v as FormFieldType) ?? 'text';
                if (type === 'select' && !draftField.options?.length) {
                  patchField({
                    type,
                    options: [{ id: randomUUID(), label: 'Option 1' }],
                  });
                } else {
                  patchField({ type });
                }
              }}
            />
            {(draftField.type === 'text' ||
              draftField.type === 'textarea' ||
              draftField.type === 'select' ||
              draftField.type === 'date') && (
              <TextInput
                label="Placeholder"
                size="xs"
                placeholder="Texte d'aide"
                value={draftField.placeholder ?? ''}
                style={{ flex: 1, minWidth: 160 }}
                onChange={(e) => patchField({ placeholder: e.currentTarget.value }, false)}
                onBlur={commitDraft}
              />
            )}
            {draftField.type === 'text' || draftField.type === 'textarea' ? (
              <TextInput
                label="Valeur par défaut"
                size="xs"
                value={draftField.defaultValue ?? ''}
                style={{ flex: 1, minWidth: 160 }}
                onChange={(e) => patchField({ defaultValue: e.currentTarget.value }, false)}
                onBlur={commitDraft}
              />
            ) : draftField.type === 'select' && draftField.multiple ? (
              <MultiSelect
                label="Valeur par défaut"
                size="xs"
                placeholder="Aucune"
                data={(draftField.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
                value={
                  draftField.defaultValue ? parseMultiSelectValue(draftField.defaultValue) : []
                }
                clearable
                style={{ flex: 1, minWidth: 160 }}
                onChange={(ids) =>
                  patchField({ defaultValue: ids.length > 0 ? JSON.stringify(ids) : '' })
                }
              />
            ) : draftField.type === 'select' ? (
              <Select
                label="Valeur par défaut"
                size="xs"
                placeholder="Aucune"
                data={(draftField.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
                value={draftField.defaultValue ?? null}
                clearable
                style={{ flex: 1, minWidth: 160 }}
                onChange={(v) => patchField({ defaultValue: v ?? '' })}
              />
            ) : draftField.type === 'date' ? (
              <div style={{ flex: 1, minWidth: 180 }}>
                <RpDatePicker
                  label="Valeur par défaut"
                  value={draftField.defaultValue ?? null}
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
              checked={draftField.required}
              onChange={(e) => patchField({ required: e.currentTarget.checked })}
            />
            {draftField.type === 'select' && (
              <Switch
                label="Sélection multiple"
                size="sm"
                checked={draftField.multiple === true}
                onChange={(e) => patchField({ multiple: e.currentTarget.checked })}
              />
            )}
            {draftField.defaultValue && (
              <Switch
                label="Modifiable"
                size="sm"
                checked={draftField.editable !== false}
                onChange={(e) => patchField({ editable: e.currentTarget.checked })}
              />
            )}
          </Group>
          {draftField.type === 'select' && (
            <>
              <Textarea
                label="Options (une par ligne)"
                size="xs"
                minRows={3}
                defaultValue={optionsText}
                onBlur={(e) => {
                  const lines = e.currentTarget.value
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean);
                  const existing = draftField.options ?? [];
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
                {(draftField.options ?? []).map((option) => (
                  <ConditionalBranchEditor
                    key={option.id}
                    optionLabel={option.label}
                    branchFields={getBranchFields(draftField, option.id)}
                    onAddField={(partial) =>
                      commitField(addFieldToBranch(draftField, option.id, partial))
                    }
                    onUpdateField={(targetId, updated) => updateNestedField(targetId, updated)}
                    onDeleteField={(targetId) => deleteNestedField(targetId)}
                    onMoveField={(targetId, direction) =>
                      commitField(moveFieldInBranch(draftField, option.id, targetId, direction))
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
