/**
 * Craft queue planning (pure, no network): simulates the queue in order, like
 * the real crafts would run, to tell which lines are ready and what has to be
 * in the source chest beforehand.
 */

export type CraftQueueEntry = {
  id: string;
  craftedItemId: string;
  recipeId: string;
  /** Number of crafts (each produces `recipe.quantity`). */
  times: number;
};

export type QueueRecipe = {
  id: string;
  name: string;
  craftedItemId: string;
  /** Produced per craft. */
  quantity: number;
  ingredients: { usedItemId: string; quantity: number; name: string }[];
};

/** `undefined`: still loading; `null`: deleted or disabled since it was queued. */
export type RecipeLookup = (recipeId: string) => QueueRecipe | null | undefined;

/** Current stock: chest id → item id → quantity (missing = 0). */
export type StockByChest = Record<string, Record<string, number>>;

export type MissingIngredient = { itemId: string; name: string; needed: number; available: number };

export type LinePlan =
  | { status: 'loading' }
  | { status: 'unavailable' }
  /** `readyNow`: craftable right away with the current stock, whatever the lines before. */
  | { status: 'ready' | 'missing'; missing: MissingIngredient[]; readyNow: boolean; produced: number };

export type IngredientTotal = {
  itemId: string;
  name: string;
  /** Consumed by the whole queue. */
  used: number;
  /** Part of `used` crafted by earlier lines of the queue (same source and destination chest). */
  producedInQueue: number;
  /** To have in the source chest before starting. */
  toHave: number;
  available: number;
  missing: number;
};

export type CraftQueuePlan = {
  lines: Record<string, LinePlan>;
  /** Ingredients of the queue, missing ones first, then by name. */
  ingredients: IngredientTotal[];
  canCraftAll: boolean;
};

export function stockOf(stock: StockByChest, chestId: string | null, itemId: string): number {
  if (!chestId) return 0;
  return stock[chestId]?.[itemId] ?? 0;
}

/** Needs of one line, an item listed twice in a recipe being added up. */
function lineNeeds(recipe: QueueRecipe, times: number): Map<string, { name: string; needed: number }> {
  const needs = new Map<string, { name: string; needed: number }>();
  for (const ingredient of recipe.ingredients) {
    const current = needs.get(ingredient.usedItemId);
    needs.set(ingredient.usedItemId, {
      name: ingredient.name,
      needed: (current?.needed ?? 0) + ingredient.quantity * times,
    });
  }
  return needs;
}

export function planCraftQueue({
  entries,
  getRecipe,
  stock,
  sourceChestId,
  destinationChestId,
}: {
  entries: readonly CraftQueueEntry[];
  getRecipe: RecipeLookup;
  stock: StockByChest;
  sourceChestId: string | null;
  destinationChestId: string | null;
}): CraftQueuePlan {
  const lines: Record<string, LinePlan> = {};
  /** Simulated stock of the source chest (items touched so far). */
  const simulated = new Map<string, number>();
  const simulatedStock = (itemId: string) => simulated.get(itemId) ?? stockOf(stock, sourceChestId, itemId);
  /** Running balance per ingredient starting from 0: its lowest point is what must be there beforehand. */
  const totals = new Map<string, { name: string; used: number; balance: number; lowest: number }>();
  const sameChest = sourceChestId !== null && sourceChestId === destinationChestId;
  let blocked = !sourceChestId || !destinationChestId;

  for (const entry of entries) {
    const recipe = getRecipe(entry.recipeId);
    if (recipe === undefined) {
      lines[entry.id] = { status: 'loading' };
      blocked = true;
      continue;
    }
    if (recipe === null) {
      lines[entry.id] = { status: 'unavailable' };
      blocked = true;
      continue;
    }

    const missing: MissingIngredient[] = [];
    let readyNow = true;
    for (const [itemId, { name, needed }] of lineNeeds(recipe, entry.times)) {
      const available = simulatedStock(itemId);
      if (available < needed) missing.push({ itemId, name, needed, available });
      if (stockOf(stock, sourceChestId, itemId) < needed) readyNow = false;
      // A shortage is reported once: the next lines start from an empty chest, not a negative one.
      simulated.set(itemId, Math.max(0, available - needed));

      const total = totals.get(itemId) ?? { name, used: 0, balance: 0, lowest: 0 };
      total.name = name;
      total.used += needed;
      total.balance -= needed;
      total.lowest = Math.min(total.lowest, total.balance);
      totals.set(itemId, total);
    }

    const produced = recipe.quantity * entry.times;
    if (sameChest) {
      // What a line crafts is there for the next ones.
      simulated.set(recipe.craftedItemId, simulatedStock(recipe.craftedItemId) + produced);
      const total = totals.get(recipe.craftedItemId);
      if (total) total.balance += produced;
      else totals.set(recipe.craftedItemId, { name: recipe.name, used: 0, balance: produced, lowest: 0 });
    }

    if (missing.length > 0) blocked = true;
    lines[entry.id] = {
      status: missing.length > 0 ? 'missing' : 'ready',
      missing,
      readyNow: readyNow && sourceChestId !== null && destinationChestId !== null,
      produced,
    };
  }

  const ingredients = [...totals.entries()]
    .filter(([, total]) => total.used > 0)
    .map(([itemId, total]): IngredientTotal => {
      const toHave = Math.max(0, -total.lowest);
      const available = stockOf(stock, sourceChestId, itemId);
      return {
        itemId,
        name: total.name,
        used: total.used,
        producedInQueue: total.used - toHave,
        toHave,
        available,
        missing: Math.max(0, toHave - available),
      };
    })
    .sort((a, b) => Number(b.missing > 0) - Number(a.missing > 0) || a.name.localeCompare(b.name, 'fr'));

  return { lines, ingredients, canCraftAll: entries.length > 0 && !blocked };
}

/** Crafts needed to obtain `missing` items with a recipe producing `recipeQuantity` per craft. */
export function subCraftTimes(missing: number, recipeQuantity: number): number {
  return Math.max(1, Math.ceil(missing / Math.max(1, recipeQuantity)));
}

/**
 * Adds a craft: an entry of the same recipe grows instead of being repeated.
 * `beforeId` inserts a new entry before that one (sub-craft of a missing ingredient).
 */
export function addToQueue(
  entries: readonly CraftQueueEntry[],
  addition: Omit<CraftQueueEntry, 'id'>,
  options: { id: string; beforeId?: string },
): CraftQueueEntry[] {
  const existing = entries.find((entry) => entry.recipeId === addition.recipeId);
  if (existing) {
    // A sub-craft must run before the line that needs it.
    const beforeIndex = options.beforeId ? entries.findIndex((entry) => entry.id === options.beforeId) : -1;
    const existingIndex = entries.indexOf(existing);
    const grown = { ...existing, times: existing.times + addition.times };
    if (beforeIndex < 0 || existingIndex < beforeIndex) {
      return entries.map((entry) => (entry.id === existing.id ? grown : entry));
    }
    const rest = entries.filter((entry) => entry.id !== existing.id);
    const at = rest.findIndex((entry) => entry.id === options.beforeId);
    return [...rest.slice(0, at), grown, ...rest.slice(at)];
  }
  const created: CraftQueueEntry = { id: options.id, ...addition };
  const at = options.beforeId ? entries.findIndex((entry) => entry.id === options.beforeId) : -1;
  return at < 0 ? [...entries, created] : [...entries.slice(0, at), created, ...entries.slice(at)];
}
