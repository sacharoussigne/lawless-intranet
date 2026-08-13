'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
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
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import classes from './SpeciesPage.module.scss';
import { SortableVariantChip } from './SortableVariantChip';
import type { BreedDTO } from './types';

export function SortableBreedCard({
  breed,
  busyKey,
  editingBreedId,
  breedDraft,
  editingVariantId,
  variantDraft,
  variantInput,
  onBreedDraftChange,
  onSaveBreed,
  onCancelEditBreed,
  onStartEditBreed,
  onDeleteBreed,
  onSavePrices,
  onVariantDraftChange,
  onSaveVariant,
  onCancelEditVariant,
  onStartEditVariant,
  onDeleteVariant,
  onVariantInputChange,
  onAddVariant,
  onVariantsReorder,
}: {
  breed: BreedDTO;
  busyKey: string | null;
  editingBreedId: string | null;
  breedDraft: string;
  editingVariantId: string | null;
  variantDraft: string;
  variantInput: string;
  onBreedDraftChange: (value: string) => void;
  onSaveBreed: () => void;
  onCancelEditBreed: () => void;
  onStartEditBreed: () => void;
  onDeleteBreed: () => void | Promise<void>;
  onSavePrices: (prices: {
    shelterPurchasePrice: number;
    animalierPurchasePrice: number | null;
  }) => void;
  onVariantDraftChange: (value: string) => void;
  onSaveVariant: (variantId: string) => void;
  onCancelEditVariant: () => void;
  onStartEditVariant: (variantId: string, label: string) => void;
  onDeleteVariant: (variantId: string) => void | Promise<void>;
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
  } = useSortable({ id: breed.id });

  const [shelterPrice, setShelterPrice] = useState<number | string>(
    breed.shelterPurchasePrice ?? '',
  );
  const [animalierPrice, setAnimalierPrice] = useState<number | string>(
    breed.animalierPurchasePrice ?? '',
  );

  useEffect(() => {
    setShelterPrice(breed.shelterPurchasePrice ?? '');
    setAnimalierPrice(breed.animalierPurchasePrice ?? '');
  }, [breed.id, breed.shelterPurchasePrice, breed.animalierPurchasePrice]);

  const shelterValue =
    typeof shelterPrice === 'number'
      ? shelterPrice
      : shelterPrice === ''
        ? null
        : Number(shelterPrice);
  const animalierValue =
    typeof animalierPrice === 'number'
      ? animalierPrice
      : animalierPrice === ''
        ? null
        : Number(animalierPrice);

  const pricesDirty =
    shelterValue !== breed.shelterPurchasePrice ||
    animalierValue !== breed.animalierPurchasePrice;

  const canSavePrices =
    pricesDirty &&
    shelterValue !== null &&
    Number.isFinite(shelterValue) &&
    shelterValue >= 0 &&
    (animalierValue === null ||
      (Number.isFinite(animalierValue) && animalierValue >= 0));

  const handleSavePrices = () => {
    if (shelterValue === null || !Number.isFinite(shelterValue)) return;
    onSavePrices({
      shelterPurchasePrice: shelterValue,
      animalierPurchasePrice:
        animalierValue === null || !Number.isFinite(animalierValue)
          ? null
          : animalierValue,
    });
  };

  const variantSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleVariantDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onVariantsReorder(String(active.id), String(over.id));
  };

  const savingBreed = busyKey === `save-breed:${breed.id}`;
  const savingPrices = busyKey === `save-prices:${breed.id}`;
  const addingVariant = busyKey === `add-variant:${breed.id}`;

  return (
    <div
      ref={setNodeRef}
      className={`${classes.breedCard} ${isDragging ? classes.isDragging : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className={classes.breedHeader}>
        {editingBreedId === breed.id ? (
          <Group gap="xs" wrap="nowrap" align="center" style={{ flex: 1 }}>
            <TextInput
              size="sm"
              value={breedDraft}
              onChange={(e) => onBreedDraftChange(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveBreed();
                if (e.key === 'Escape') onCancelEditBreed();
              }}
              style={{ flex: 1 }}
              autoFocus
            />
            <ActionIcon
              size="sm"
              color="terracotta"
              variant="filled"
              onClick={onSaveBreed}
              loading={savingBreed}
            >
              <IconCheck size={14} />
            </ActionIcon>
          </Group>
        ) : (
          <>
            <div className={classes.titleActions}>
              <button
                type="button"
                className={classes.dragHandle}
                aria-label={`Réordonner ${breed.name}`}
                {...attributes}
                {...listeners}
              >
                <IconGripVertical size={16} stroke={1.5} />
              </button>
              <Text fw={700} className={classes.breedName}>
                {breed.name}
              </Text>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="terracotta"
                aria-label={`Renommer ${breed.name}`}
                onClick={onStartEditBreed}
              >
                <IconPencil size={14} />
              </ActionIcon>
            </div>
            <DeleteConfirmPopover
              title="Supprimer la race"
              message={`Supprimer la race « ${breed.name} » et ses variantes ?`}
              onConfirm={onDeleteBreed}
            >
              <ActionIcon
                size="sm"
                variant="subtle"
                color="danger"
                aria-label={`Supprimer ${breed.name}`}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </DeleteConfirmPopover>
          </>
        )}
      </div>

      <div className={classes.priceRow}>
        <NumberInput
          size="sm"
          label="Prix d’achat refuge"
          placeholder="0.00"
          value={shelterPrice}
          onChange={setShelterPrice}
          min={0}
          decimalScale={2}
          fixedDecimalScale
          step={0.01}
          required
        />
        <NumberInput
          size="sm"
          label="Prix d’achat animalier"
          placeholder="Optionnel"
          value={animalierPrice}
          onChange={setAnimalierPrice}
          min={0}
          decimalScale={2}
          fixedDecimalScale
          step={0.01}
          allowNegative={false}
        />
        <Button
          size="sm"
          color="terracotta"
          variant="light"
          className={classes.priceSave}
          onClick={handleSavePrices}
          disabled={!canSavePrices}
          loading={savingPrices}
        >
          Enregistrer les prix
        </Button>
      </div>

      <Text size="xs" c="dimmed" mb={6}>
        Variantes
      </Text>
      {breed.variants.length === 0 ? (
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
            items={breed.variants.map((v) => v.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className={classes.chipRow}>
              {breed.variants.map((variant) => (
                <SortableVariantChip
                  key={variant.id}
                  variant={variant}
                  editing={editingVariantId === variant.id}
                  draft={variantDraft}
                  saving={busyKey === `save-variant:${variant.id}`}
                  onDraftChange={onVariantDraftChange}
                  onSave={() => onSaveVariant(variant.id)}
                  onCancelEdit={onCancelEditVariant}
                  onStartEdit={() => onStartEditVariant(variant.id, variant.label)}
                  onDelete={() => onDeleteVariant(variant.id)}
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
          loading={addingVariant}
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}
