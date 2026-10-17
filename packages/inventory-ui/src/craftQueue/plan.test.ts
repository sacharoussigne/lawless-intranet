import { describe, expect, it } from 'vitest';
import {
  addToQueue,
  planCraftQueue,
  resolveSubCrafts,
  subCraftTimes,
  type CraftQueueEntry,
  type QueueRecipe,
} from './plan';
import { craftQueueStorageKey, parseStoredCraftQueue } from './storage';

const CHEST = 'chest-a';
const OTHER = 'chest-b';

/** Tincture: 2 herbs + 1 alcohol → 1 tincture. Remedy: 2 tinctures + 1 herb → 1 remedy. */
const tincture: QueueRecipe = {
  id: 'r-tincture',
  name: 'Teinture',
  craftedItemId: 'tincture',
  quantity: 1,
  ingredients: [
    { usedItemId: 'herb', quantity: 2, name: 'Herbe' },
    { usedItemId: 'alcohol', quantity: 1, name: 'Alcool' },
  ],
};
const remedy: QueueRecipe = {
  id: 'r-remedy',
  name: 'Remède',
  craftedItemId: 'remedy',
  quantity: 1,
  ingredients: [
    { usedItemId: 'tincture', quantity: 2, name: 'Teinture' },
    { usedItemId: 'herb', quantity: 1, name: 'Herbe' },
  ],
};
/** Alcohol: 1 grain → 2 alcohol. */
const alcohol: QueueRecipe = {
  id: 'r-alcohol',
  name: 'Alcool',
  craftedItemId: 'alcohol',
  quantity: 2,
  ingredients: [{ usedItemId: 'grain', quantity: 1, name: 'Grain' }],
};
const recipes = new Map([tincture, remedy, alcohol].map((recipe) => [recipe.id, recipe]));

const entry = (
  id: string,
  recipe: QueueRecipe,
  times: number,
  chests: { source?: string; destination?: string } = {},
): CraftQueueEntry => ({
  id,
  craftedItemId: recipe.craftedItemId,
  recipeId: recipe.id,
  times,
  sourceChestId: chests.source ?? CHEST,
  destinationChestId: chests.destination ?? CHEST,
});

function plan(entries: CraftQueueEntry[], stock: Record<string, number>) {
  return planCraftQueue({ entries, getRecipe: (id) => recipes.get(id) ?? null, stock: { [CHEST]: stock } });
}

const total = (result: ReturnType<typeof plan>, itemId: string, chestId = CHEST) =>
  result.ingredients.find((ingredient) => ingredient.itemId === itemId && ingredient.chestId === chestId);

describe('planCraftQueue', () => {
  it('adds up an ingredient used by several lines', () => {
    const result = plan([entry('a', tincture, 3), entry('b', remedy, 1)], { herb: 10, alcohol: 5, tincture: 2 });
    expect(total(result, 'herb')).toMatchObject({ used: 7, toHave: 7, available: 10, missing: 0 });
    expect(total(result, 'alcohol')).toMatchObject({ used: 3, toHave: 3, missing: 0 });
    expect(result.canCraftAll).toBe(true);
    expect(result.missingCount).toBe(0);
  });

  it('counts what an earlier line crafts into the same chest', () => {
    const result = plan([entry('a', tincture, 2), entry('b', remedy, 1)], { herb: 5, alcohol: 2 });
    expect(total(result, 'tincture')).toMatchObject({ used: 2, producedInQueue: 2, toHave: 0, missing: 0 });
    expect(total(result, 'herb')).toMatchObject({ toHave: 5, missing: 0 });
    expect(result.lines.b).toMatchObject({ status: 'ready', readyNow: false });
    expect(result.canCraftAll).toBe(true);
  });

  it('flags a sub-craft placed after the line that needs it', () => {
    const result = plan([entry('b', remedy, 1), entry('a', tincture, 2)], { herb: 5, alcohol: 2 });
    expect(result.lines.b).toMatchObject({
      status: 'missing',
      missing: [{ itemId: 'tincture', needed: 2, available: 0 }],
    });
    expect(total(result, 'tincture')).toMatchObject({ toHave: 2, missing: 2 });
    expect(result.canCraftAll).toBe(false);
    expect(result.missingCount).toBe(1);
  });

  it('keeps each line on its own chests', () => {
    // The tinctures go to another chest: the remedy, taking from the first one, does not get them.
    const result = planCraftQueue({
      entries: [entry('a', tincture, 2, { destination: OTHER }), entry('b', remedy, 1)],
      getRecipe: (id) => recipes.get(id) ?? null,
      stock: { [CHEST]: { herb: 5, alcohol: 2 }, [OTHER]: {} },
    });
    expect(total(result, 'tincture')).toMatchObject({ producedInQueue: 0, toHave: 2, missing: 2 });
    expect(result.canCraftAll).toBe(false);

    // A line taking from the other chest does get them.
    const fed = planCraftQueue({
      entries: [entry('a', tincture, 2, { destination: OTHER }), entry('b', remedy, 1, { source: OTHER })],
      getRecipe: (id) => recipes.get(id) ?? null,
      stock: { [CHEST]: { herb: 4, alcohol: 2 }, [OTHER]: { herb: 1 } },
    });
    expect(total(fed, 'tincture', OTHER)).toMatchObject({ producedInQueue: 2, missing: 0 });
    expect(total(fed, 'herb', OTHER)).toMatchObject({ toHave: 1, missing: 0 });
    expect(fed.canCraftAll).toBe(true);
  });

  it('reports the shortage of each line, once', () => {
    const result = plan([entry('a', tincture, 2), entry('b', tincture, 1, { destination: OTHER })], {
      herb: 3,
      alcohol: 9,
    });
    expect(result.lines.a).toMatchObject({ missing: [{ itemId: 'herb', needed: 4, available: 3 }], produced: 2 });
    expect(result.lines.b).toMatchObject({ missing: [{ itemId: 'herb', needed: 2, available: 0 }] });
    expect(total(result, 'herb')).toMatchObject({ toHave: 6, missing: 3 });
    expect(result.ingredients[0]).toMatchObject({ itemId: 'herb' });
  });

  it('blocks on recipes still loading or gone', () => {
    const lookups = { 'r-tincture': undefined, 'r-remedy': null } as const;
    const result = planCraftQueue({
      entries: [entry('a', tincture, 1), entry('b', remedy, 1)],
      getRecipe: (id) => lookups[id as keyof typeof lookups],
      stock: {},
    });
    expect(result.lines.a).toEqual({ status: 'loading' });
    expect(result.lines.b).toEqual({ status: 'unavailable' });
    expect(result.canCraftAll).toBe(false);
  });

  it('adds an item listed twice in a recipe', () => {
    const doubled: QueueRecipe = {
      ...tincture,
      id: 'r-doubled',
      ingredients: [...tincture.ingredients, { usedItemId: 'herb', quantity: 2, name: 'Herbe' }],
    };
    const result = planCraftQueue({
      entries: [entry('a', doubled, 1)],
      getRecipe: () => doubled,
      stock: { [CHEST]: { herb: 3, alcohol: 1 } },
    });
    expect(result.lines.a).toMatchObject({ status: 'missing', missing: [{ itemId: 'herb', needed: 4 }] });
  });

  it('cannot craft an empty queue', () => {
    expect(plan([], {}).canCraftAll).toBe(false);
  });
});

describe('subCraftTimes', () => {
  it('rounds up to whole crafts', () => {
    expect(subCraftTimes(5, 2)).toBe(3);
    expect(subCraftTimes(4, 2)).toBe(2);
    expect(subCraftTimes(1, 0)).toBe(1);
  });
});

describe('addToQueue', () => {
  const queue = [entry('a', tincture, 1), entry('b', remedy, 1)];
  const addition = (recipe: QueueRecipe, times: number, chests: { source?: string; destination?: string } = {}) => {
    const { id: _id, ...rest } = entry('x', recipe, times, chests);
    return rest;
  };

  it('appends a new craft and grows the same one', () => {
    expect(addToQueue(queue, addition(alcohol, 2), { id: 'c' }).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(addToQueue(queue, addition(tincture, 2), { id: 'c' })[0]).toMatchObject({ id: 'a', times: 3 });
  });

  it('keeps the same recipe with other chests apart', () => {
    expect(addToQueue(queue, addition(tincture, 2, { destination: OTHER }), { id: 'c' })).toHaveLength(3);
  });

  it('puts a sub-craft before the line that needs it', () => {
    expect(addToQueue(queue, addition(alcohol, 1), { id: 'c', beforeId: 'b' }).map((e) => e.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
    const moved = addToQueue([entry('b', remedy, 1), entry('a', tincture, 1)], addition(tincture, 1), {
      id: 'c',
      beforeId: 'b',
    });
    expect(moved.map((e) => [e.id, e.times])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
});

describe('resolveSubCrafts', () => {
  const byItem: Record<string, QueueRecipe | null> = { tincture, alcohol, herb: null, grain: null };
  let ids = 0;

  function resolve(entries: CraftQueueEntry[], stock: Record<string, number>, known = byItem) {
    return resolveSubCrafts({
      entries,
      targetId: 't',
      getRecipe: (id) => (entries.some((e) => e.recipeId === id) ? (recipes.get(id) ?? null) : undefined),
      recipeForItem: (itemId) => (itemId in known ? known[itemId] : undefined),
      stock: { [CHEST]: stock },
      newId: () => `sub-${(ids += 1)}`,
    });
  }

  it('adds the missing crafts, deepest first, before the line, on the same chests', () => {
    // 1 remedy needs 2 tinctures, which need 2 alcohol (1 craft: 2) and 4 herbs.
    const result = resolve([entry('t', remedy, 1)], { herb: 5, grain: 3 });
    expect(result.kind).toBe('done');
    if (result.kind !== 'done') return;
    expect(result.entries.map((e) => [e.recipeId, e.times, e.sourceChestId])).toEqual([
      ['r-alcohol', 1, CHEST],
      ['r-tincture', 2, CHEST],
      ['r-remedy', 1, CHEST],
    ]);
    expect(result.added).toEqual([
      { itemId: 'tincture', name: 'Teinture', times: 2 },
      { itemId: 'alcohol', name: 'Alcool', times: 1 },
    ]);
    expect(plan(result.entries, { herb: 5, grain: 3 }).canCraftAll).toBe(true);
  });

  it('asks for recipes it does not know yet', () => {
    expect(resolve([entry('t', remedy, 1)], { herb: 5 }, {})).toEqual({ kind: 'fetch', itemIds: ['tincture'] });
  });

  it('adds nothing when a missing ingredient cannot be crafted, at any depth', () => {
    expect(resolve([entry('t', remedy, 1)], { herb: 1, grain: 3 })).toEqual({ kind: 'not-craftable', names: ['Herbe'] });
  });

  it('does nothing when the line is already ready', () => {
    expect(resolve([entry('t', tincture, 1)], { herb: 2, alcohol: 1 })).toMatchObject({ kind: 'done', added: [] });
  });

  it('gives up when the line crafts into another chest', () => {
    expect(resolve([entry('t', remedy, 1, { destination: OTHER })], { herb: 9 })).toEqual({ kind: 'other-chest' });
  });
});

describe('stored queue', () => {
  it('keeps one queue per dispensary', () => {
    expect(craftQueueStorageKey('saint-denis')).toBe('craft.queue.v2:saint-denis');
  });

  it('drops anything invalid', () => {
    expect(parseStoredCraftQueue('not json').entries).toEqual([]);
    expect(parseStoredCraftQueue(null).entries).toEqual([]);
    const valid = { id: 'a', craftedItemId: 'i', recipeId: 'r', times: 2, sourceChestId: CHEST, destinationChestId: OTHER };
    const parsed = parseStoredCraftQueue(
      JSON.stringify({ entries: [valid, { ...valid, id: 'b', times: 0 }, { ...valid, id: 'c', sourceChestId: null }, 'nope'] }),
    );
    expect(parsed.entries).toEqual([valid]);
  });
});
