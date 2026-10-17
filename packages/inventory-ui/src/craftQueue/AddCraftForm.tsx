'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Group, NumberInput, Select, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useInventoryUi } from '../InventoryUiProvider';
import { unwrapActionResult } from '../lib/actionResult';
import { craftKeys, DEFAULT_STALE_TIME_MS } from '../lib/queryKeys';
import { getLastRecipeIdForItem, setLastRecipeIdForItem } from '../stock/modals/craftNavStorage';
import type { ItemWithRelations } from '../types';
import type { CraftQueueEntry } from './plan';

/** Craftable items of the source chest, in the stock order (same as the craft modal). */
export function craftableItems(items: readonly ItemWithRelations[]) {
  return items
    .filter((item) => item.isCraftable)
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
}

export function AddCraftForm({
  items,
  disabled,
  onAdd,
}: {
  items: readonly ItemWithRelations[];
  disabled: boolean;
  onAdd: (addition: Omit<CraftQueueEntry, 'id'>) => void;
}) {
  const { scopeKey, actions } = useInventoryUi();
  const [itemId, setItemId] = useState<string | null>(null);
  const [pickedRecipeId, setPickedRecipeId] = useState<string | null>(null);
  const [times, setTimes] = useState<number | string>(1);

  const options = useMemo(
    () => craftableItems(items).map((item) => ({ value: item.id, label: item.name })),
    [items],
  );

  const recipesQuery = useQuery({
    queryKey: craftKeys.recipes(scopeKey, itemId ?? ''),
    queryFn: async () => unwrapActionResult(await actions.getCraftRecipesByItemId(itemId ?? '', true)),
    enabled: Boolean(itemId),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
  const recipes = itemId ? (recipesQuery.data ?? []) : [];

  // Picked, else the only one, else the last one used for this item.
  const recipeId =
    (pickedRecipeId && recipes.some((recipe) => recipe.id === pickedRecipeId) ? pickedRecipeId : null) ??
    (recipes.length === 1 ? (recipes[0]?.id ?? null) : null) ??
    (itemId && recipes.some((recipe) => recipe.id === getLastRecipeIdForItem(itemId))
      ? getLastRecipeIdForItem(itemId)
      : null);
  const recipe = recipes.find((candidate) => candidate.id === recipeId);
  const count = typeof times === 'number' && Number.isInteger(times) && times >= 1 ? times : null;
  const noRecipe = Boolean(itemId) && recipesQuery.isSuccess && recipes.length === 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!itemId || !recipe || !count) return;
    setLastRecipeIdForItem(itemId, recipe.id);
    onAdd({ craftedItemId: itemId, recipeId: recipe.id, times: count });
    setItemId(null);
    setPickedRecipeId(null);
    setTimes(1);
  };

  return (
    <form onSubmit={submit}>
      <Group align="flex-start" gap="sm" wrap="wrap">
        <Select
          label="Objet à craft"
          placeholder={disabled ? 'Choisissez d’abord un coffre' : 'Rechercher un objet craftable'}
          data={options}
          value={itemId}
          onChange={(value) => {
            setItemId(value);
            setPickedRecipeId(null);
          }}
          searchable
          clearable
          nothingFoundMessage="Aucun objet craftable"
          disabled={disabled}
          error={noRecipe ? 'Aucune recette active pour cet objet' : undefined}
          style={{ flex: '2 1 220px' }}
        />
        {recipes.length > 1 ? (
          <Select
            label="Recette"
            placeholder="Choisir une recette"
            data={recipes.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            value={recipeId}
            onChange={setPickedRecipeId}
            allowDeselect={false}
            style={{ flex: '1 1 180px' }}
          />
        ) : null}
        <NumberInput
          label="Nombre de fois"
          value={times}
          onChange={setTimes}
          min={1}
          allowDecimal={false}
          allowNegative={false}
          disabled={disabled}
          description={recipe && count ? `Produit ${recipe.quantity * count}` : undefined}
          inputWrapperOrder={['label', 'input', 'description']}
          style={{ flex: '0 1 130px' }}
        />
        <Button
          type="submit"
          color="sage"
          leftSection={<IconPlus size={16} />}
          disabled={disabled || !recipe || !count}
          loading={recipesQuery.isFetching && recipes.length === 0}
          mt={25}
        >
          Ajouter
        </Button>
      </Group>
      {recipe?.description ? (
        <Text size="xs" c="dimmed" mt={4}>
          {recipe.description}
        </Text>
      ) : null}
    </form>
  );
}
