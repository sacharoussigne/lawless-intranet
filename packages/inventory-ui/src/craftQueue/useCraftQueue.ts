'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useLocalStorage } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useInventoryUi } from '../InventoryUiProvider';
import { unwrapActionResult } from '../lib/actionResult';
import { getEffectiveStockQuantity } from '../lib/ensureTodayStock';
import { craftKeys, DEFAULT_STALE_TIME_MS, stockKeys } from '../lib/queryKeys';
import { useCraftMutation } from '../stock/hooks/useStockQueries';
import { getLastRecipeIdForItem } from '../stock/modals/craftNavStorage';
import type { CraftRecipeWithIngredients, ItemWithRelations } from '../types';
import {
  addToQueue,
  planCraftQueue,
  resolveSubCrafts,
  type CraftQueueEntry,
  type CraftQueuePlan,
  type QueueRecipe,
  type RecipeLookup,
  type StockByChest,
  type SubCraftResolution,
} from './plan';
import {
  craftQueueStorageKey,
  EMPTY_CRAFT_QUEUE,
  newCraftQueueEntryId,
  parseStoredCraftQueue,
  type StoredCraftQueue,
} from './storage';

export type CraftAddition = Omit<CraftQueueEntry, 'id'>;

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

function toStock(items: readonly ItemWithRelations[]): Record<string, number> {
  return Object.fromEntries(
    items.map((item) => [item.id, getEffectiveStockQuantity(item.stockToday, item.stockYesterday) ?? 0]),
  );
}

/** Enabled recipes and chest stock, through the shared query cache. */
function useQueueFetchers() {
  const { scopeKey, actions } = useInventoryUi();
  const queryClient = useQueryClient();
  const fetchRecipes = useCallback(
    (itemId: string) =>
      queryClient.fetchQuery({
        queryKey: craftKeys.recipes(scopeKey, itemId),
        queryFn: async () => unwrapActionResult(await actions.getCraftRecipesByItemId(itemId, true)),
        staleTime: DEFAULT_STALE_TIME_MS,
      }),
    [actions, queryClient, scopeKey],
  );
  const fetchChestItems = useCallback(
    (chestId: string) =>
      queryClient.fetchQuery({
        queryKey: stockKeys.items(scopeKey, chestId),
        queryFn: async () => unwrapActionResult(await actions.getItemsWithStock(chestId)),
        staleTime: DEFAULT_STALE_TIME_MS,
      }),
    [actions, queryClient, scopeKey],
  );
  return { fetchRecipes, fetchChestItems };
}

/** Recipes of the queued items: `undefined` while loading, `null` once deleted or disabled. */
function useQueueRecipes(entries: readonly CraftQueueEntry[]): RecipeLookup {
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
    const loadedItems = new Set(itemIds.filter((_itemId, index) => results[index]?.data !== undefined));
    const byRecipe = new Map<string, QueueRecipe>();
    for (const result of results) {
      for (const recipe of result?.data ?? []) byRecipe.set(recipe.id, toQueueRecipe(recipe));
    }
    return (recipeId: string) => {
      const recipe = byRecipe.get(recipeId);
      if (recipe) return recipe;
      const entry = entries.find((candidate) => candidate.recipeId === recipeId);
      return entry && loadedItems.has(entry.craftedItemId) ? null : undefined;
    };
  }, [entries, itemIds, results]);
}

/** Stock of every chest used by the queue, and the items seen in them (names, craftable). */
function useQueueStock(entries: readonly CraftQueueEntry[]) {
  const { scopeKey, actions } = useInventoryUi();
  const chestIds = useMemo(
    () => [...new Set(entries.flatMap((entry) => [entry.sourceChestId, entry.destinationChestId]))],
    [entries],
  );
  const results = useQueries({
    queries: chestIds.map((chestId) => ({
      queryKey: stockKeys.items(scopeKey, chestId),
      queryFn: async () => unwrapActionResult(await actions.getItemsWithStock(chestId)),
      staleTime: DEFAULT_STALE_TIME_MS,
    })),
  });

  return useMemo(() => {
    const stock: StockByChest = {};
    const items = new Map<string, ItemWithRelations>();
    chestIds.forEach((chestId, index) => {
      const data = results[index]?.data ?? [];
      stock[chestId] = toStock(data);
      for (const item of data) items.set(item.id, item);
    });
    return { stock, items };
  }, [chestIds, results]);
}

export type CraftQueue = {
  entries: CraftQueueEntry[];
  plan: CraftQueuePlan;
  getRecipe: RecipeLookup;
  itemName: (itemId: string) => string;
  isCraftable: (itemId: string) => boolean;
  /** Adds a craft and, when every missing ingredient can be crafted, its sub-crafts before it. */
  addCraft: (addition: CraftAddition) => Promise<void>;
  /** Adds the craft of one missing ingredient of a line, before it. */
  addSubCraft: (entry: CraftQueueEntry, itemId: string, missing: number) => Promise<void>;
  setTimes: (id: string, times: number) => void;
  remove: (id: string) => void;
  reorder: (entries: CraftQueueEntry[]) => void;
  clear: () => void;
  runner: CraftQueueRunner;
};

/**
 * Craft queue of this dispensary, kept in the browser: one state shared by the
 * craft modal (adds) and the floating queue (shows, crafts).
 */
export function useCraftQueue(): CraftQueue {
  const { scopeKey } = useInventoryUi();
  const [stored, setStored] = useLocalStorage<StoredCraftQueue>({
    key: craftQueueStorageKey(scopeKey),
    defaultValue: EMPTY_CRAFT_QUEUE,
    serialize: JSON.stringify,
    deserialize: (value) => parseStoredCraftQueue(value ?? null),
  });
  const { entries } = stored;
  const setEntries = useCallback(
    (change: (current: CraftQueueEntry[]) => CraftQueueEntry[]) =>
      setStored((current) => ({ entries: change(current.entries) })),
    [setStored],
  );

  const getRecipe = useQueueRecipes(entries);
  const { stock, items } = useQueueStock(entries);
  const { fetchRecipes, fetchChestItems } = useQueueFetchers();
  const plan = useMemo(() => planCraftQueue({ entries, getRecipe, stock }), [entries, getRecipe, stock]);

  const itemName = (itemId: string) =>
    items.get(itemId)?.name ??
    entries
      .map((entry) => getRecipe(entry.recipeId))
      .find((recipe) => recipe && recipe.craftedItemId === itemId)?.name ??
    'Objet';
  const isCraftable = (itemId: string) => Boolean(items.get(itemId)?.isCraftable);

  /** Recipe used to craft an item: the last one picked, else the first enabled one. */
  const recipeForItem = async (itemId: string) => {
    const recipes = await fetchRecipes(itemId);
    const last = getLastRecipeIdForItem(itemId);
    const recipe = recipes.find((candidate) => candidate.id === last) ?? recipes[0];
    return recipe ? toQueueRecipe(recipe) : null;
  };

  const resolve = async (withNew: CraftQueueEntry[], target: CraftQueueEntry): Promise<SubCraftResolution> => {
    // The new line may use a chest and a recipe the queue has not loaded yet.
    const [targetRecipes, sourceItems] = await Promise.all([
      fetchRecipes(target.craftedItemId),
      fetchChestItems(target.sourceChestId),
    ]);
    const knownRecipes = new Map(targetRecipes.map((recipe) => [recipe.id, toQueueRecipe(recipe)]));
    const fullStock: StockByChest = { ...stock, [target.sourceChestId]: toStock(sourceItems) };
    const craftable = new Map(sourceItems.map((item) => [item.id, item.isCraftable]));
    const byItem = new Map<string, QueueRecipe | null>();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = resolveSubCrafts({
        entries: withNew,
        targetId: target.id,
        getRecipe: (recipeId) => knownRecipes.get(recipeId) ?? getRecipe(recipeId),
        recipeForItem: (itemId) => byItem.get(itemId),
        stock: fullStock,
        newId: newCraftQueueEntryId,
      });
      if (result.kind !== 'fetch') return result;
      await Promise.all(
        result.itemIds.map(async (itemId) => {
          byItem.set(itemId, craftable.get(itemId) === false ? null : await recipeForItem(itemId));
        }),
      );
    }
    return { kind: 'loop' };
  };

  const addCraft = async (addition: CraftAddition) => {
    const withNew = addToQueue(entries, addition, { id: newCraftQueueEntryId() });
    const target = withNew.find(
      (entry) =>
        entry.recipeId === addition.recipeId &&
        entry.sourceChestId === addition.sourceChestId &&
        entry.destinationChestId === addition.destinationChestId,
    );
    if (!target) return;
    const label = items.get(addition.craftedItemId)?.name ?? 'Craft';

    let result: SubCraftResolution;
    try {
      result = await resolve(withNew, target);
    } catch {
      result = { kind: 'loop' };
    }
    if (result.kind === 'done') {
      setEntries(() => result.entries);
      notifications.show({
        title: 'Ajouté à la file',
        message:
          result.added.length > 0
            ? `${label} ×${addition.times}, avec les sous-crafts : ${result.added.map((sub) => `${sub.name} ×${sub.times}`).join(', ')}.`
            : `${label} ×${addition.times}.`,
        color: 'moss',
      });
      return;
    }
    setEntries(() => withNew);
    const reason =
      result.kind === 'not-craftable'
        ? `${result.names.join(', ')} ne se crafte${result.names.length > 1 ? 'nt' : ''} pas : sous-crafts non ajoutés.`
        : result.kind === 'other-chest'
          ? 'Sous-crafts non ajoutés : les objets craftés vont dans un autre coffre que la source.'
          : 'Sous-crafts non ajoutés.';
    notifications.show({ title: `${label} ajouté, ingrédients manquants`, message: reason, color: 'amber' });
  };

  const addSubCraft = async (entry: CraftQueueEntry, itemId: string, missing: number) => {
    try {
      const recipe = await recipeForItem(itemId);
      if (!recipe) {
        notifications.show({ message: 'Aucune recette active pour cet ingrédient.', color: 'danger' });
        return;
      }
      const times = Math.max(1, Math.ceil(missing / Math.max(1, recipe.quantity)));
      setEntries((current) =>
        addToQueue(
          current,
          {
            craftedItemId: itemId,
            recipeId: recipe.id,
            times,
            sourceChestId: entry.sourceChestId,
            destinationChestId: entry.sourceChestId,
          },
          { id: newCraftQueueEntryId(), beforeId: entry.id },
        ),
      );
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : 'Chargement des recettes impossible',
        color: 'danger',
      });
    }
  };

  const remove = useCallback((id: string) => setEntries((current) => current.filter((entry) => entry.id !== id)), [setEntries]);
  const runner = useCraftQueueRunner({ onCrafted: remove });

  return {
    entries,
    plan,
    getRecipe,
    itemName,
    isCraftable,
    addCraft,
    addSubCraft,
    setTimes: (id, times) =>
      setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, times } : entry))),
    remove,
    reorder: (next) => setEntries(() => next),
    clear: () => setEntries(() => []),
    runner,
  };
}

export type CraftQueueRunner = {
  /** Entry being crafted (one at a time). */
  runningId: string | null;
  runningAll: boolean;
  busy: boolean;
  craftLine: (entry: CraftQueueEntry, label: string) => Promise<boolean>;
  craftAll: (entries: readonly CraftQueueEntry[], labelOf: (entry: CraftQueueEntry) => string) => Promise<void>;
};

/**
 * Crafts queue lines with the normal craft (stock checked by the service). A
 * crafted line leaves the queue; « Tout crafter » goes in order and stops at
 * the first failure (stock changed meanwhile), keeping the remaining lines.
 */
function useCraftQueueRunner({ onCrafted }: { onCrafted: (entryId: string) => void }): CraftQueueRunner {
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
        sourceChestId: entry.sourceChestId,
        ingredientChests: [],
        destinationChestId: entry.destinationChestId,
        affectedChestIds: [entry.sourceChestId, entry.destinationChestId],
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

  return { runningId, runningAll, busy: runningId !== null || runningAll, craftLine, craftAll };
}
