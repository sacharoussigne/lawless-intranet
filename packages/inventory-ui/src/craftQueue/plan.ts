/**
 * Craft queue planning (pure, no network): simulates the queue in order, like
 * the real crafts would run, to tell which lines are ready and what has to be
 * in each source chest beforehand. Each line keeps the chests it was added with.
 */

export type CraftQueueEntry = {
  id: string;
  craftedItemId: string;
  recipeId: string;
  /** Number of crafts (each produces `recipe.quantity`). */
  times: number;
  /** Ingredients are taken from this chest. */
  sourceChestId: string;
  /** Crafted items go to this chest. */
  destinationChestId: string;
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
  chestId: string;
  itemId: string;
  name: string;
  /** Consumed by the whole queue from this chest. */
  used: number;
  /** Part of `used` crafted into this chest by earlier lines of the queue. */
  producedInQueue: number;
  /** To have in this chest before starting. */
  toHave: number;
  available: number;
  missing: number;
};

export type CraftQueuePlan = {
  lines: Record<string, LinePlan>;
  /** Ingredients of the queue per chest, missing ones first, then by name. */
  ingredients: IngredientTotal[];
  canCraftAll: boolean;
  /** Lines short of something (with the current order and stock). */
  missingCount: number;
};

export function stockOf(stock: StockByChest, chestId: string, itemId: string): number {
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

const slot = (chestId: string, itemId: string) => `${chestId}\u0000${itemId}`;

type RunningTotal = { chestId: string; itemId: string; name: string; used: number; balance: number; lowest: number };

export function planCraftQueue({
  entries,
  getRecipe,
  stock,
}: {
  entries: readonly CraftQueueEntry[];
  getRecipe: RecipeLookup;
  stock: StockByChest;
}): CraftQueuePlan {
  const lines: Record<string, LinePlan> = {};
  /** Simulated stock of the chests touched so far. */
  const simulated = new Map<string, number>();
  const simulatedStock = (chestId: string, itemId: string) =>
    simulated.get(slot(chestId, itemId)) ?? stockOf(stock, chestId, itemId);
  /** Running balance per chest and item starting from 0: its lowest point is what must be there beforehand. */
  const totals = new Map<string, RunningTotal>();
  const totalOf = (chestId: string, itemId: string, name: string): RunningTotal => {
    const key = slot(chestId, itemId);
    const existing = totals.get(key);
    if (existing) return existing;
    const created = { chestId, itemId, name, used: 0, balance: 0, lowest: 0 };
    totals.set(key, created);
    return created;
  };
  let blocked = false;
  let missingCount = 0;

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
      missingCount += 1;
      continue;
    }

    const missing: MissingIngredient[] = [];
    let readyNow = true;
    for (const [itemId, { name, needed }] of lineNeeds(recipe, entry.times)) {
      const available = simulatedStock(entry.sourceChestId, itemId);
      if (available < needed) missing.push({ itemId, name, needed, available });
      if (stockOf(stock, entry.sourceChestId, itemId) < needed) readyNow = false;
      // A shortage is reported once: the next lines start from an empty chest, not a negative one.
      simulated.set(slot(entry.sourceChestId, itemId), Math.max(0, available - needed));

      const consumed = totalOf(entry.sourceChestId, itemId, name);
      consumed.name = name;
      consumed.used += needed;
      consumed.balance -= needed;
      consumed.lowest = Math.min(consumed.lowest, consumed.balance);
    }

    // What a line crafts is there for the next lines taking from the same chest.
    const produced = recipe.quantity * entry.times;
    const destination = entry.destinationChestId;
    simulated.set(slot(destination, recipe.craftedItemId), simulatedStock(destination, recipe.craftedItemId) + produced);
    totalOf(destination, recipe.craftedItemId, recipe.name).balance += produced;

    if (missing.length > 0) {
      blocked = true;
      missingCount += 1;
    }
    lines[entry.id] = { status: missing.length > 0 ? 'missing' : 'ready', missing, readyNow, produced };
  }

  const ingredients = [...totals.values()]
    .filter((item) => item.used > 0)
    .map((item): IngredientTotal => {
      const toHave = Math.max(0, -item.lowest);
      const available = stockOf(stock, item.chestId, item.itemId);
      return {
        chestId: item.chestId,
        itemId: item.itemId,
        name: item.name,
        used: item.used,
        producedInQueue: item.used - toHave,
        toHave,
        available,
        missing: Math.max(0, toHave - available),
      };
    })
    .sort((a, b) => Number(b.missing > 0) - Number(a.missing > 0) || a.name.localeCompare(b.name, 'fr'));

  return { lines, ingredients, canCraftAll: entries.length > 0 && !blocked, missingCount };
}

/** Crafts needed to obtain `missing` items with a recipe producing `recipeQuantity` per craft. */
export function subCraftTimes(missing: number, recipeQuantity: number): number {
  return Math.max(1, Math.ceil(missing / Math.max(1, recipeQuantity)));
}

type CraftKey = Pick<CraftQueueEntry, 'recipeId' | 'sourceChestId' | 'destinationChestId'>;

const sameCraft = (a: CraftKey, b: CraftKey) =>
  a.recipeId === b.recipeId && a.sourceChestId === b.sourceChestId && a.destinationChestId === b.destinationChestId;

/**
 * Adds a craft: an entry of the same recipe and chests grows instead of being repeated.
 * `beforeId` inserts a new entry before that one (sub-craft of a missing ingredient).
 */
export function addToQueue(
  entries: readonly CraftQueueEntry[],
  addition: Omit<CraftQueueEntry, 'id'>,
  options: { id: string; beforeId?: string },
): CraftQueueEntry[] {
  const existing = entries.find((entry) => sameCraft(entry, addition));
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

export type AddedSubCraft = { itemId: string; name: string; times: number };

export type SubCraftResolution =
  /** `entries` holds the target line and the sub-crafts it needs, each before its consumer. */
  | { kind: 'done'; entries: CraftQueueEntry[]; added: AddedSubCraft[] }
  /** Recipes of these items are not loaded yet: load them and resolve again. */
  | { kind: 'fetch'; itemIds: string[] }
  /** A missing ingredient cannot be crafted (at any depth): nothing is added. */
  | { kind: 'not-craftable'; names: string[] }
  /** Crafted items go to another chest: sub-crafts would not feed the line. */
  | { kind: 'other-chest' }
  /** Recipes that need each other: given up after too many steps. */
  | { kind: 'loop' };

const MAX_SUB_CRAFT_STEPS = 50;

/**
 * Adds, before `targetId`, the crafts of its missing ingredients (same chests),
 * then the crafts their own lines miss, until every line it added is ready.
 * Only when every missing ingredient (at any depth) has a recipe.
 * `recipeForItem`: recipe used to craft an item (`undefined`: not loaded yet,
 * `null`: none). `getRecipe` must know the queued recipes.
 */
export function resolveSubCrafts({
  entries,
  targetId,
  getRecipe,
  recipeForItem,
  stock,
  newId,
}: {
  entries: readonly CraftQueueEntry[];
  targetId: string;
  getRecipe: RecipeLookup;
  recipeForItem: (itemId: string) => QueueRecipe | null | undefined;
  stock: StockByChest;
  newId: () => string;
}): SubCraftResolution {
  const addedRecipes = new Map<string, QueueRecipe>();
  const lookup: RecipeLookup = (recipeId) => getRecipe(recipeId) ?? addedRecipes.get(recipeId);
  let current = [...entries];
  const managed = new Set([targetId]);
  const added = new Map<string, AddedSubCraft>();

  for (let step = 0; step < MAX_SUB_CRAFT_STEPS; step += 1) {
    const plan = planCraftQueue({ entries: current, getRecipe: lookup, stock });
    const line = current.find((entry) => managed.has(entry.id) && plan.lines[entry.id]?.status === 'missing');
    if (!line) return { kind: 'done', entries: current, added: [...added.values()] };

    const linePlan = plan.lines[line.id];
    const missing = linePlan && 'missing' in linePlan ? linePlan.missing : [];
    const toFetch = missing.filter((item) => recipeForItem(item.itemId) === undefined).map((item) => item.itemId);
    if (toFetch.length > 0) return { kind: 'fetch', itemIds: toFetch };
    const notCraftable = missing.filter((item) => recipeForItem(item.itemId) === null);
    if (notCraftable.length > 0) return { kind: 'not-craftable', names: notCraftable.map((item) => item.name) };
    if (line.sourceChestId !== line.destinationChestId) return { kind: 'other-chest' };

    const [first] = missing;
    const recipe = first ? recipeForItem(first.itemId) : null;
    if (!first || !recipe) return { kind: 'loop' };
    addedRecipes.set(recipe.id, recipe);
    const times = subCraftTimes(first.needed - first.available, recipe.quantity);
    const addition = {
      craftedItemId: first.itemId,
      recipeId: recipe.id,
      times,
      sourceChestId: line.sourceChestId,
      destinationChestId: line.destinationChestId,
    };
    current = addToQueue(current, addition, { id: newId(), beforeId: line.id });
    const subLine = current.find((entry) => sameCraft(entry, addition));
    if (subLine) managed.add(subLine.id);
    const previous = added.get(first.itemId);
    added.set(first.itemId, { itemId: first.itemId, name: first.name, times: (previous?.times ?? 0) + times });
  }
  return { kind: 'loop' };
}
