import { describe, expect, it } from 'vitest';
import { addToQueue, planCraftQueue, subCraftTimes, type CraftQueueEntry, type QueueRecipe } from './plan';
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
const recipes = new Map([tincture, remedy].map((recipe) => [recipe.id, recipe]));

const entry = (id: string, recipe: QueueRecipe, times: number): CraftQueueEntry => ({
  id,
  craftedItemId: recipe.craftedItemId,
  recipeId: recipe.id,
  times,
});

function plan(entries: CraftQueueEntry[], stock: Record<string, number>, destination = CHEST) {
  return planCraftQueue({
    entries,
    getRecipe: (id) => recipes.get(id) ?? null,
    stock: { [CHEST]: stock },
    sourceChestId: CHEST,
    destinationChestId: destination,
  });
}

const total = (result: ReturnType<typeof plan>, itemId: string) =>
  result.ingredients.find((ingredient) => ingredient.itemId === itemId);

describe('planCraftQueue', () => {
  it('adds up an ingredient used by several lines', () => {
    const result = plan([entry('a', tincture, 3), entry('b', remedy, 1)], { herb: 10, alcohol: 5, tincture: 2 });
    expect(total(result, 'herb')).toMatchObject({ used: 7, toHave: 7, available: 10, missing: 0 });
    expect(total(result, 'alcohol')).toMatchObject({ used: 3, toHave: 3, missing: 0 });
    expect(result.canCraftAll).toBe(true);
  });

  it('counts what an earlier line crafts for the next ones', () => {
    // 2 tinctures crafted first cover the remedy: nothing to bring but herbs and alcohol.
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
  });

  it('does not count crafts sent to another chest', () => {
    const result = plan([entry('a', tincture, 2), entry('b', remedy, 1)], { herb: 5, alcohol: 2 }, OTHER);
    expect(total(result, 'tincture')).toMatchObject({ producedInQueue: 0, toHave: 2, missing: 2 });
    expect(result.canCraftAll).toBe(false);
  });

  it('reports the shortage of each line and of the totals', () => {
    const result = plan([entry('a', tincture, 4)], { herb: 5, alcohol: 4 });
    expect(result.lines.a).toMatchObject({
      status: 'missing',
      missing: [{ itemId: 'herb', name: 'Herbe', needed: 8, available: 5 }],
      readyNow: false,
      produced: 4,
    });
    expect(result.ingredients[0]).toMatchObject({ itemId: 'herb', missing: 3 });
  });

  it('blocks on recipes still loading or gone', () => {
    const lookups = { 'r-tincture': undefined, 'r-remedy': null } as const;
    const result = planCraftQueue({
      entries: [entry('a', tincture, 1), entry('b', remedy, 1)],
      getRecipe: (id) => lookups[id as keyof typeof lookups],
      stock: {},
      sourceChestId: CHEST,
      destinationChestId: CHEST,
    });
    expect(result.lines.a).toEqual({ status: 'loading' });
    expect(result.lines.b).toEqual({ status: 'unavailable' });
    expect(result.canCraftAll).toBe(false);
  });

  it('needs a chest and at least one line', () => {
    expect(plan([], {}).canCraftAll).toBe(false);
    const noChest = planCraftQueue({
      entries: [entry('a', tincture, 1)],
      getRecipe: (id) => recipes.get(id) ?? null,
      stock: { [CHEST]: { herb: 9, alcohol: 9 } },
      sourceChestId: null,
      destinationChestId: CHEST,
    });
    expect(noChest.canCraftAll).toBe(false);
  });

  it('adds an item listed twice in a recipe', () => {
    const doubled: QueueRecipe = { ...tincture, id: 'r-doubled', ingredients: [...tincture.ingredients, { usedItemId: 'herb', quantity: 2, name: 'Herbe' }] };
    const result = planCraftQueue({
      entries: [entry('a', doubled, 1)],
      getRecipe: () => doubled,
      stock: { [CHEST]: { herb: 3, alcohol: 1 } },
      sourceChestId: CHEST,
      destinationChestId: CHEST,
    });
    expect(result.lines.a).toMatchObject({ status: 'missing', missing: [{ itemId: 'herb', needed: 4 }] });
  });
});

describe('shortage on several lines', () => {
  it('reports each shortage once', () => {
    const result = plan([entry('a', tincture, 2), entry('b', tincture, 1)], { herb: 3, alcohol: 9 });
    expect(result.lines.a).toMatchObject({ missing: [{ itemId: 'herb', needed: 4, available: 3 }] });
    expect(result.lines.b).toMatchObject({ missing: [{ itemId: 'herb', needed: 2, available: 0 }] });
    expect(total(result, 'herb')).toMatchObject({ toHave: 6, missing: 3 });
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

  it('appends a new recipe and grows a queued one', () => {
    expect(addToQueue(queue, { craftedItemId: 'x', recipeId: 'r-x', times: 2 }, { id: 'c' }).map((e) => e.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(addToQueue(queue, { craftedItemId: 'tincture', recipeId: 'r-tincture', times: 2 }, { id: 'c' })[0]).toMatchObject({
      id: 'a',
      times: 3,
    });
  });

  it('puts a sub-craft before the line that needs it', () => {
    const added = addToQueue(queue, { craftedItemId: 'x', recipeId: 'r-x', times: 1 }, { id: 'c', beforeId: 'b' });
    expect(added.map((e) => e.id)).toEqual(['a', 'c', 'b']);
    const moved = addToQueue(
      [entry('b', remedy, 1), entry('a', tincture, 1)],
      { craftedItemId: 'tincture', recipeId: 'r-tincture', times: 1 },
      { id: 'c', beforeId: 'b' },
    );
    expect(moved.map((e) => [e.id, e.times])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
});

describe('stored queue', () => {
  it('keeps one queue per dispensary', () => {
    expect(craftQueueStorageKey('saint-denis')).toBe('craft.queue.v1:saint-denis');
  });

  it('drops anything invalid', () => {
    expect(parseStoredCraftQueue('not json').entries).toEqual([]);
    expect(parseStoredCraftQueue(null).sourceChestId).toBeNull();
    const parsed = parseStoredCraftQueue(
      JSON.stringify({
        entries: [
          { id: 'a', craftedItemId: 'i', recipeId: 'r', times: 2 },
          { id: 'b', craftedItemId: 'i', recipeId: 'r', times: 0 },
          'nope',
        ],
        sourceChestId: CHEST,
        destinationChestId: 42,
      }),
    );
    expect(parsed).toEqual({
      entries: [{ id: 'a', craftedItemId: 'i', recipeId: 'r', times: 2 }],
      sourceChestId: CHEST,
      destinationChestId: null,
    });
  });
});
