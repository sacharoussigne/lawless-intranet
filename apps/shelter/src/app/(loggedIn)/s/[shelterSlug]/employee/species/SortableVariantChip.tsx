'use client';

import { ActionIcon, Group, TextInput } from '@mantine/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconCheck, IconGripVertical, IconPencil, IconTrash } from '@tabler/icons-react';
import classes from './SpeciesPage.module.scss';
import type { SpeciesVariantDTO } from './types';

export function SortableVariantChip({
  variant,
  editing,
  draft,
  onDraftChange,
  onSave,
  onCancelEdit,
  onStartEdit,
  onDelete,
}: {
  variant: SpeciesVariantDTO;
  editing: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: variant.id, disabled: editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (editing) {
    return (
      <div ref={setNodeRef} style={style}>
        <Group gap={4} wrap="nowrap">
          <TextInput
            size="xs"
            value={draft}
            onChange={(e) => onDraftChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancelEdit();
            }}
            autoFocus
          />
          <ActionIcon size="sm" color="terracotta" variant="filled" onClick={onSave}>
            <IconCheck size={14} />
          </ActionIcon>
        </Group>
      </div>
    );
  }

  return (
    <span
      ref={setNodeRef}
      className={`${classes.chip} ${isDragging ? classes.isDragging : ''}`}
      style={style}
    >
      <button
        type="button"
        className={classes.dragHandleInline}
        aria-label={`Réordonner ${variant.label}`}
        {...attributes}
        {...listeners}
      >
        <IconGripVertical size={14} stroke={1.5} />
      </button>
      {variant.label}
      <button
        type="button"
        className={classes.chipButton}
        aria-label={`Renommer ${variant.label}`}
        onClick={onStartEdit}
      >
        <IconPencil size={14} />
      </button>
      <button
        type="button"
        className={classes.chipButton}
        aria-label={`Supprimer ${variant.label}`}
        onClick={onDelete}
      >
        <IconTrash size={14} />
      </button>
    </span>
  );
}
