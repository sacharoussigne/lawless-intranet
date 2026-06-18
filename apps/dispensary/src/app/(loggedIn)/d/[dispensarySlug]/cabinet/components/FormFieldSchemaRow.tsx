'use client';

import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ActionIcon,
  Badge,
  Button,
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

export type FormFieldSchemaRowProps = {
  field: FormField;
  depth?: number;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onChange: (field: FormField) => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: 'up' | 'down') => void;
  schemaNestedFlushToken?: number;
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

function formFieldSchemaRowPropsAreEqual(
  prev: FormFieldSchemaRowProps,
  next: FormFieldSchemaRowProps,
): boolean {
  return (
    prev.field === next.field &&
    prev.expanded === next.expanded &&
    prev.depth === next.depth &&
    prev.canMoveUp === next.canMoveUp &&
    prev.canMoveDown === next.canMoveDown &&
    prev.schemaNestedFlushToken === next.schemaNestedFlushToken &&
    prev.onChange === next.onChange &&
    prev.onExpandedChange === next.onExpandedChange
  );
}

function FormFieldSchemaRowInner({
  field,
  depth = 0,
  expanded: expandedProp,
  onExpandedChange,
  onChange,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
  onMove,
  schemaNestedFlushToken,
}: FormFieldSchemaRowProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = expandedProp ?? internalExpanded;
  const [draftField, setDraftField] = useState(field);
  const draftFieldRef = useRef(draftField);
  draftFieldRef.current = draftField;
  const optionsText = (draftField.options ?? []).map((o) => o.label).join('\n');
  const prevExpandedRef = useRef(expanded);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useLayoutEffect(() => {
    if (expanded && !prevExpandedRef.current) {
      draftFieldRef.current = field;
      setDraftField(field);
    }
  }, [expanded, field]);

  useLayoutEffect(() => {
    if (prevExpandedRef.current && !expanded) {
      onChangeRef.current(draftFieldRef.current);
    }
    prevExpandedRef.current = expanded;
  }, [expanded]);

  useLayoutEffect(() => {
    return () => {
      onChangeRef.current(draftFieldRef.current);
    };
  }, []);

  const applyDraftField = useCallback(
    (updater: FormField | ((prev: FormField) => FormField)) => {
      const next =
        typeof updater === 'function'
          ? (updater as (prev: FormField) => FormField)(draftFieldRef.current)
          : updater;
      draftFieldRef.current = next;
      setDraftField(next);
    },
    [],
  );

  const setExpanded = useCallback(
    (next: boolean) => {
      if (onExpandedChange) {
        onExpandedChange(next);
      } else {
        setInternalExpanded(next);
      }
    },
    [onExpandedChange],
  );

  const patchField = useCallback(
    (updates: Partial<FormField>) => {
      applyDraftField((prev) => normalizePatchedField(prev, updates));
    },
    [applyDraftField],
  );

  const updateNestedField = useCallback(
    (targetId: string, updated: FormField) => {
      applyDraftField((prev) => mapFieldById(prev, targetId, () => updated));
    },
    [applyDraftField],
  );

  const deleteNestedField = useCallback(
    (targetId: string) => {
      applyDraftField((prev) => deleteFieldById(prev, targetId));
    },
    [applyDraftField],
  );

  const headerLabel = expanded ? draftField.label : field.label;
  const headerType = expanded ? draftField.type : field.type;
  const headerRequired = expanded ? draftField.required : field.required;
  const headerEditable = expanded ? draftField.editable : field.editable;
  const headerMultiple = expanded ? draftField.multiple : field.multiple;

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
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
          <InlineEditableText
            value={headerLabel}
            canEdit={expanded}
            onSave={(label) => patchField({ label })}
            textClassName="disp-display-title"
          />
          <Text size="xs" c="dimmed">
            ({FIELD_TYPES.find((t) => t.value === headerType)?.label ?? headerType})
            {headerRequired && ' *'}
          </Text>
          {headerEditable === false && (
            <Badge variant="outline" color="slate" size="xs">
              Fixe
            </Badge>
          )}
          {headerType === 'select' && headerMultiple && (
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

      {expanded && (
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
                onChange={(e) => patchField({ placeholder: e.currentTarget.value })}
              />
            )}
            {draftField.type === 'text' || draftField.type === 'textarea' ? (
              <TextInput
                label="Valeur par défaut"
                size="xs"
                value={draftField.defaultValue ?? ''}
                style={{ flex: 1, minWidth: 160 }}
                onChange={(e) => patchField({ defaultValue: e.currentTarget.value })}
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
                    schemaNestedFlushToken={schemaNestedFlushToken}
                    onAddField={(partial) =>
                      applyDraftField((prev) => addFieldToBranch(prev, option.id, partial))
                    }
                    onUpdateField={updateNestedField}
                    onDeleteField={deleteNestedField}
                    onMoveField={(targetId, direction) =>
                      applyDraftField((prev) =>
                        moveFieldInBranch(prev, option.id, targetId, direction),
                      )
                    }
                    depth={depth + 1}
                  />
                ))}
              </Stack>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
}

export const FormFieldSchemaRow = memo(FormFieldSchemaRowInner, formFieldSchemaRowPropsAreEqual);

type ConditionalBranchEditorProps = {
  optionLabel: string;
  branchFields: FormField[];
  schemaNestedFlushToken?: number;
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
  schemaNestedFlushToken,
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
  const [expandedNestedFieldId, setExpandedNestedFieldId] = useState<string | null>(null);
  const lastSchemaFlushTokenRef = useRef(0);

  useLayoutEffect(() => {
    if (schemaNestedFlushToken === undefined) return;
    if (schemaNestedFlushToken <= lastSchemaFlushTokenRef.current) return;
    lastSchemaFlushTokenRef.current = schemaNestedFlushToken;
    if (expandedNestedFieldId !== null) {
      flushSync(() => setExpandedNestedFieldId(null));
    }
  }, [schemaNestedFlushToken, expandedNestedFieldId]);

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

  const handleNestedExpandedChange = useCallback((fieldId: string, next: boolean) => {
    setExpandedNestedFieldId((current) => {
      if (next) return fieldId;
      return current === fieldId ? null : current;
    });
  }, []);

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
            expanded={expandedNestedFieldId === child.id}
            onExpandedChange={(next) => handleNestedExpandedChange(child.id, next)}
            onChange={(updated) => onUpdateField(child.id, updated)}
            onDelete={() => onDeleteField(child.id)}
            canMoveUp={index > 0}
            canMoveDown={index < sortedFields.length - 1}
            onMove={(direction) => onMoveField(child.id, direction)}
            schemaNestedFlushToken={schemaNestedFlushToken}
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
