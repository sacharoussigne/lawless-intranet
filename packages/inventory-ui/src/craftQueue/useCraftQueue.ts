'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useLocalStorage } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useInventoryUi } from '../InventoryUiProvider';
import { unwrapActionResult } from '../lib/actionResult';
import { getEffectiveStockQuantity } from '../lib/ensureTodayStock';
import { craftKeys, DEFAULT_STALE_TIME_MS } from '../lib/queryKeys';
import { useCraftMutation, useStockItems } from '../stock/hooks/useStockQueries';
import type { ChestListItem, CraftRecipeWithIngredients, ItemWithRelations } from '../types';
import { addToQueue, type CraftQueueEntry, type QueueRecipe, type RecipeLookup, type StockByChest } from './plan';
import {
  craftQueueStorageKey,
  EMPTY_CRAFT_QUEUE,
  newCraftQueueEntryId,
  parseStoredCraftQueue,
  type StoredCraftQueue,
} from './storage';

export function toQueueRecipe(recipe: CraftRecipeWithIngredients): QueueRecipe {
  return {
    id: recipe.id,
    name: recipe.name,
    craftedItemId: recipe.craftedItemId,
    quantity: recipe.quantity,
    ingredients: recipe.ingredients.map((ingredient) => ({
      usedItemId: ingredient.usedItemId,
      quantity: ingredient.quantity,
      name: ingredient.usedItem.name,
    })),
  };
}

/** Enabled recipes of an item, cached per item (shared by the queue and the add form). */
export function useCraftRecipesFetcher() {
  const { scopeKey, actions } = useInventoryUi();
  const queryClient = useQueryClient();
  return useCallback(
    (itemId: string) =>
      queryClient.fetchQuery({
        queryKey: craftKeys.recipes(scopeKey, itemId),
        queryFn: async () => unwrapActionResult(await actions.getCraftRecipesByItemId(itemId, true)),
        staleTime: DEFAULT_STALE_TIME_MS,
      }),
    [actions, queryClient, scopeKey],
  );
}

/** Queue and chests of this dispensary, kept in the browser. */
export function useCraftQueueState(chests: readonly ChestListItem[]) {
  const { scopeKey } = useInventoryUi();
  const [stored, setStored] = useLocalStorage<StoredCraftQueue>({
    key: craftQueueStorageKey(scopeKey),
    defaultValue: EMPTY_CRAFT_QUEUE,
    serialize: JSON.stringify,
    deserialize: (value) => parseStoredCraftQueue(value ?? null),
  });

  // A chest that is gone (or not accessible anymore) falls back to the only one, if any.
  const known = (id: string | null) => (id && chests.some((chest) => chest.id === id) ? id : null);
  const fallback = chests.length === 1 ? (chests[0]?.id ?? null) : null;
  const sourceChestId = known(stored.sourceChestId) ?? fallback;
  const destinationChestId = known(stored.destinationChestId) ?? sourceChestId;

  const update = useCallback(
    (change: (current: StoredCraftQueue) => Partial<StoredCraftQueue>) =>
      setStored((current) => ({ ...current, ...change(current) })),
    [setStored],
  );

  return {
    entries: stored.entries,
    sourceChestId,
    destinationChestId,
    setSourceChestId: (id: string | null) =>
      // The destination follows the source while they were the same, like the craft modal.
      update((current) => ({
        sourceChestId: id,
        destinationChestId:
          !current.destinationChestId || current.destinationChestId === current.sourceChestId
            ? id
            : current.destinationChestId,
      })),
    setDestinationChestId: (id: string | null) => update(() => ({ destinationChestId: id })),
    add: (addition: Omit<CraftQueueEntry, 'id'>, beforeId?: string) =>
      update((current) => ({
        entries: addToQueue(current.entries, addition, { id: newCraftQueueEntryId(), beforeId }),
      })),
    setTimes: (id: string, times: number) =>
      update((current) => ({
        entries: current.entries.map((entry) => (entry.id === id ? { ...entry, times } : entry)),
      })),
    remove: (id: string) => update((current) => ({ entries: current.entries.filter((entry) => entry.id !== id) })),
    reorder: (entries: CraftQueueEntry[]) => update(() => ({ entries })),
    clear: () => update(() => ({ entries: [] })),
  };
}

/** Recipes of the queued items: `undefined` while loading, `null` once deleted or disabled. */
export function useQueueRecipes(entries: readonly CraftQueueEntry[]): RecipeLookup {
  const { scopeKey, actions } = useInventoryUi();
  const itemIds = useMemo(() => [...new Set(entries.map((entry) => entry.craftedItemId))], [entries]);
  const results = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: craftKeys.recipes(scopeKey, itemId),
      queryFn: async () => unwrapActionResult(await actions.getCraftRecipesByItemId(itemId, true)),
      staleTime: DEFAULT_STALE_TIME_MS,
    })),
  });

  return useMemo(() => {
    const byItem = new Map(itemIds.map((itemId, index) => [itemId, results[index]]));
    const byRecipe = new Map<string, QueueRecipe>();
    for (const result of results) {
      for (const recipe of result?.data ?? []) byRecipe.set(recipe.id, toQueueRecipe(recipe));
    }
    return (recipeId: string) => {
      const recipe = byRecipe.get(recipeId);
      if (recipe) return recipe;
      const entry = entries.find((candidate) => candidate.recipeId === recipeId);
      const query = entry ? byItem.get(entry.craftedItemId) : undefined;
      return query?.data ? null : undefined;
    };
  }, [entries, itemIds, results]);
}

function toStock(items: readonly ItemWithRelations[]): Record<string, number> {
  return Object.fromEntries(
    items.map((item) => [item.id, getEffectiveStockQuantity(item.stockToday, item.stockYesterday) ?? 0]),
  );
}

/** Stock of the source (and destination) chest, plus the source chest items. */
export function useQueueStock(sourceChestId: string | null, destinationChestId: string | null) {
  const source = useStockItems(sourceChestId, undefined, { enabled: Boolean(sourceChestId) });
  const otherDestination = destinationChestId && destinationChestId !== sourceChestId ? destinationChestId : null;
  const destination = useStockItems(otherDestination, undefined, { enabled: Boolean(otherDestination) });

  const stock = useMemo<StockByChest>(() => {
    const result: StockByChest = {};
    if (sourceChestId) result[sourceChestId] = toStock(source.data ?? []);
    if (otherDestination) result[otherDestination] = toStock(destination.data ?? []);
    return result;
  }, [sourceChestId, source.data, otherDestination, destination.data]);

  return { stock, items: sourceChestId ? (source.data ?? []) : [], loading: source.isLoading };
}

export type CraftQueueRunner = {
  /** Entry being crafted (one at a time). */
  runningId: string | null;
  runningAll: boolean;
  craftLine: (entry: CraftQueueEntry, label: string) => Promise<boolean>;
  craftAll: (entries: readonly CraftQueueEntry[], labelOf: (entry: CraftQueueEntry) => string) => Promise<void>;
};

/**
 * Crafts queue lines with the normal craft (stock checked by the service). A
 * crafted line leaves the queue; « Tout crafter » goes in order and stops at
 * the first failure (stock changed meanwhile), keeping the remaining lines.
 */
export function useCraftQueueRunner({
  sourceChestId,
  destinationChestId,
  onCrafted,
}: {
  sourceChestId: string | null;
  destinationChestId: string | null;
  onCrafted: (entryId: string) => void;
}): CraftQueueRunner {
  const craft = useCraftMutation();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const run = async (entry: CraftQueueEntry) => {
    setRunningId(entry.id);
    try {
      const result = await craft.mutateAsync({
        itemId: entry.craftedItemId,
        recipeId: entry.recipeId,
        times: entry.times,
        sourceChestId,
        ingredientChests: [],
        destinationChestId,
        affectedChestIds: [sourceChestId, destinationChestId],
      });
      onCrafted(entry.id);
      return { ok: true as const, produced: result.quantityProduced };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : 'Craft impossible' };
    } finally {
      setRunningId(null);
    }
  };

  const craftLine = async (entry: CraftQueueEntry, label: string) => {
    const result = await run(entry);
    if (result.ok) {
      notifications.show({
        title: 'Craft effectué',
        message: `${label} ×${entry.times} : ${result.produced} produit${result.produced > 1 ? 's' : ''}.`,
        color: 'moss',
      });
    } else {
      notifications.show({ title: `Craft de ${label} impossible`, message: result.message, color: 'danger' });
    }
    return result.ok;
  };

  const craftAll = async (entries: readonly CraftQueueEntry[], labelOf: (entry: CraftQueueEntry) => string) => {
    setRunningAll(true);
    let done = 0;
    try {
      for (const entry of entries) {
        const result = await run(entry);
        if (!result.ok) {
          notifications.show({
            title: done > 0 ? `${done} craft${done > 1 ? 's' : ''} effectué${done > 1 ? 's' : ''}, puis arrêt` : 'Craft impossible',
            message: `${labelOf(entry)} : ${result.message}. Les lignes restantes sont gardées dans la file.`,
            color: 'danger',
            autoClose: false,
          });
          return;
        }
        done += 1;
      }
      notifications.show({
        title: 'File terminée',
        message: `${done} craft${done > 1 ? 's' : ''} effectué${done > 1 ? 's' : ''}.`,
        color: 'moss',
      });
    } finally {
      setRunningAll(false);
    }
  };

  return { runningId, runningAll, craftLine, craftAll };
}
