'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  TextInput,
} from '@mantine/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconCheck,
  IconGripVertical,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import classes from './SpeciesPage.module.scss';
import type { BreedDTO } from './types';

export function SortableBreedCard({
  breed,
  selected,
  busyKey,
  editingBreedId,
  breedDraft,
  onBreedDraftChange,
  onSaveBreed,
  onCancelEditBreed,
  onStartEditBreed,
  onDeleteBreed,
  onSavePrices,
  onSelect,
}: {
  breed: BreedDTO;
  selected: boolean;
  busyKey: string | null;
  editingBreedId: string | null;
  breedDraft: string;
  onBreedDraftChange: (value: string) => void;
  onSaveBreed: () => void;
  onCancelEditBreed: () => void;
  onStartEditBreed: () => void;
  onDeleteBreed: () => void | Promise<void>;
  onSavePrices: (prices: {
    shelterPurchasePrice: number;
    animalierPurchasePrice: number | null;
  }) => void;
  onSelect: () => void;
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

  const savingBreed = busyKey === `save-breed:${breed.id}`;
  const savingPrices = busyKey === `save-prices:${breed.id}`;
  const isEditing = editingBreedId === breed.id;

  const priceLabel = breed.shelterPurchasePrice != null
    ? `$${breed.shelterPurchasePrice.toFixed(2)}${breed.animalierPurchasePrice != null ? ` / $${breed.animalierPurchasePrice.toFixed(2)}` : ''}`
    : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div
        className={`${classes.breedRow} ${selected ? classes.breedRowActive : ''} ${isDragging ? classes.isDragging : ''}`}
      >
        <button
          type="button"
          className={classes.dragHandle}
          aria-label={`Réordonner ${breed.name}`}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <IconGripVertical size={15} stroke={1.5} />
        </button>

        {isEditing ? (
          <Group gap="xs" wrap="nowrap" align="center" style={{ flex: 1 }}>
            <TextInput
              size="xs"
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
            <button
              type="button"
              className={classes.breedRowName}
              onClick={onSelect}
              aria-pressed={selected}
            >
              {breed.name}
            </button>
            {priceLabel ? (
              <span className={classes.breedRowPrices} style={{ paddingTop: "3px"}}>{priceLabel}</span>
            ) : null}
            <div className={classes.breedRowActions}>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="terracotta"
                aria-label={`Renommer ${breed.name}`}
                onClick={(e) => { e.stopPropagation(); onStartEditBreed(); }}
              >
                <IconPencil size={13} />
              </ActionIcon>
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
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconTrash size={13} />
                </ActionIcon>
              </DeleteConfirmPopover>
            </div>
          </>
        )}
      </div>

      {selected && !isEditing && (
        <div className={classes.breedPriceEdit}>
          <div className={classes.priceInputRow}>
            <NumberInput
              size="sm"
              label="Prix d'achat refuge"
              placeholder="0.00"
              value={shelterPrice}
              onChange={setShelterPrice}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSavePrices) handleSavePrices(); }}
              min={0}
              decimalScale={2}
              fixedDecimalScale
              step={0.01}
              required
            />
            <NumberInput
              size="sm"
              label="Prix d'achat animalier"
              placeholder="Optionnel"
              value={animalierPrice}
              onChange={setAnimalierPrice}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSavePrices) handleSavePrices(); }}
              min={0}
              decimalScale={2}
              fixedDecimalScale
              step={0.01}
              allowNegative={false}
            />
          </div>
          <Button
            size="sm"
            color="terracotta"
            variant="light"
            onClick={handleSavePrices}
            disabled={!canSavePrices}
            loading={savingPrices}
            style={{ alignSelf: 'flex-start' }}
          >
            Enregistrer les prix
          </Button>
        </div>
      )}
    </div>
  );
}
