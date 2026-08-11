'use client';

import {
  ActionIcon,
  Button,
  Group,
  Text,
  TextInput,
} from '@mantine/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconCheck,
  IconGripVertical,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import classes from './SpeciesPage.module.scss';
import { SortableVariantChip } from './SortableVariantChip';
import type { SubspeciesDTO } from './types';

export function SortableSubspeciesCard({
  sub,
  pending,
  editingSubId,
  subDraft,
  editingVariantId,
  variantDraft,
  variantInput,
  onSubDraftChange,
  onSaveSubspecies,
  onCancelEditSub,
  onStartEditSub,
  onDeleteSub,
  onVariantDraftChange,
  onSaveVariant,
  onCancelEditVariant,
  onStartEditVariant,
  onDeleteVariant,
  onVariantInputChange,
  onAddVariant,
  onVariantsReorder,
}: {
  sub: SubspeciesDTO;
  pending: boolean;
  editingSubId: string | null;
  subDraft: string;
  editingVariantId: string | null;
  variantDraft: string;
  variantInput: string;
  onSubDraftChange: (value: string) => void;
  onSaveSubspecies: () => void;
  onCancelEditSub: () => void;
  onStartEditSub: () => void;
  onDeleteSub: () => void;
  onVariantDraftChange: (value: string) => void;
  onSaveVariant: (variantId: string) => void;
  onCancelEditVariant: () => void;
  onStartEditVariant: (variantId: string, label: string) => void;
  onDeleteVariant: (variantId: string, label: string) => void;
  onVariantInputChange: (value: string) => void;
  onAddVariant: () => void;
  onVariantsReorder: (activeId: string, overId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sub.id });

  const variantSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleVariantDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onVariantsReorder(String(active.id), String(over.id));
  };

  return (
    <div
      ref={setNodeRef}
      className={`${classes.subspeciesCard} ${isDragging ? classes.isDragging : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Group justify="space-between" wrap="wrap" mb="xs" align="flex-start">
        {editingSubId === sub.id ? (
          <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
            <TextInput
              size="sm"
              value={subDraft}
              onChange={(e) => onSubDraftChange(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveSubspecies();
                if (e.key === 'Escape') onCancelEditSub();
              }}
              style={{ flex: 1 }}
              autoFocus
            />
            <ActionIcon
              size="sm"
              color="terracotta"
              variant="filled"
              onClick={onSaveSubspecies}
            >
              <IconCheck size={14} />
            </ActionIcon>
          </Group>
        ) : (
          <Group gap="xs" wrap="nowrap">
            <button
              type="button"
              className={classes.dragHandle}
              aria-label={`Réordonner ${sub.name}`}
              {...attributes}
              {...listeners}
            >
              <IconGripVertical size={16} stroke={1.5} />
            </button>
            <Text fw={700}>{sub.name}</Text>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="terracotta"
              aria-label={`Renommer ${sub.name}`}
              onClick={onStartEditSub}
            >
              <IconPencil size={14} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="danger"
              aria-label={`Supprimer ${sub.name}`}
              onClick={onDeleteSub}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        )}
      </Group>

      <Text size="xs" c="dimmed" mb={6}>
        Variantes
      </Text>
      {sub.variants.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aucune variante.
        </Text>
      ) : (
        <DndContext
          sensors={variantSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleVariantDragEnd}
        >
          <SortableContext
            items={sub.variants.map((v) => v.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className={classes.chipRow}>
              {sub.variants.map((variant) => (
                <SortableVariantChip
                  key={variant.id}
                  variant={variant}
                  editing={editingVariantId === variant.id}
                  draft={variantDraft}
                  onDraftChange={onVariantDraftChange}
                  onSave={() => onSaveVariant(variant.id)}
                  onCancelEdit={onCancelEditVariant}
                  onStartEdit={() => onStartEditVariant(variant.id, variant.label)}
                  onDelete={() => onDeleteVariant(variant.id, variant.label)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <div className={classes.quickAdd} style={{ marginTop: '0.65rem' }}>
        <TextInput
          size="sm"
          placeholder="Ajouter une variante (ex. Long poils)"
          value={variantInput}
          onChange={(e) => onVariantInputChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAddVariant();
          }}
          style={{ flex: 1 }}
          maxLength={255}
        />
        <Button
          size="sm"
          color="terracotta"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={onAddVariant}
          loading={pending}
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}
