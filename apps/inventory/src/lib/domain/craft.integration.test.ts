/**
 * Craft integration tests, against the LOCAL inventory database (DATABASE_URL
 * of apps/inventory/.env). Each run works in its own throwaway scope and
 * deletes it afterwards. Skipped when the database is not on localhost.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '@/lib/prisma';
import { getTodayStart } from '@/lib/date';
import { craftItem } from '@/lib/domain/stock';
import { listStockMovements } from '@/lib/domain/movements';
// The craft queue logic of the UI (pure): its plan must match what the service really does.
import {
  planCraftQueue,
  type CraftQueueEntry,
  type QueueRecipe,
} from '../../../../../packages/inventory-ui/src/craftQueue/plan';

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return ['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

const scope = { scopeType: 'test-craft', scopeId: randomUUID() };
const USER = 'test-user';

type Ids = Record<'herb' | 'alcohol' | 'grain' | 'tincture' | 'remedy', string>;
let items: Ids;
let chestA: string;
let chestB: string;
let recipes: { tincture: string; remedy: string; alcohol: string };

async function createItem(name: string, categoryId: string, isCraftable = false) {
  const item = await prisma.item.create({
    data: { ...scope, name, minimalQuantity: 0, isCraftable, categoryId },
  });
  return item.id;
}

async function createRecipe(
  name: string,
  craftedItemId: string,
  quantity: number,
  ingredients: { usedItemId: string; quantity: number }[],
) {
  const recipe = await prisma.craftRecipe.create({
    data: { ...scope, name, craftedItemId, quantity, ingredients: { create: ingredients } },
  });
  return recipe.id;
}

/** Sets the stock of an item in a chest, today (or yesterday: carried over by the craft). */
async function setStock(itemId: string, chestId: string, quantity: number, day: 'today' | 'yesterday' = 'today') {
  const timestamp = day === 'today' ? new Date() : new Date(getTodayStart().getTime() - 6 * 3600 * 1000);
  await prisma.stockHistory.create({ data: { itemId, chestId, quantity, timestamp } });
}

/** Current stock (today's latest row, else the latest earlier one, else 0). */
async function stock(itemId: string, chestId: string): Promise<number> {
  const row = await prisma.stockHistory.findFirst({
    where: { itemId, chestId },
    orderBy: { timestamp: 'desc' },
  });
  return row?.quantity ?? 0;
}

async function movements() {
  return prisma.stockItemMovement.findMany({
    where: { itemId: { in: Object.values(items) } },
    select: { itemId: true, chestId: true, quantity: true, kind: true, userId: true },
  });
}

function craft(recipeId: string, craftedItemId: string, times: number, chests: { source?: string; destination?: string; ingredientChests?: { ingredientId: string; chestId: string }[] } = {}) {
  return craftItem({
    ...scope,
    craftedItemId,
    recipeId,
    times,
    sourceChestId: chests.source ?? chestA,
    destinationChestId: chests.destination ?? chestA,
    ingredientChests: chests.ingredientChests ?? [],
    userId: USER,
    effectiveRole: null,
  });
}

describe.skipIf(!isLocalDatabase(process.env.DATABASE_URL))('craftItem (local database)', () => {
  beforeAll(async () => {
    const category = await prisma.categoryItem.create({ data: { ...scope, name: 'Test craft' } });
    items = {
      herb: await createItem('Herbe', category.id),
      alcohol: await createItem('Alcool', category.id, true),
      grain: await createItem('Grain', category.id),
      tincture: await createItem('Teinture', category.id, true),
      remedy: await createItem('Remède', category.id, true),
    };
    chestA = (await prisma.chest.create({ data: { ...scope, name: 'Coffre A' } })).id;
    chestB = (await prisma.chest.create({ data: { ...scope, name: 'Coffre B' } })).id;
    recipes = {
      // 2 herbs + 1 alcohol → 1 tincture
      tincture: await createRecipe('Teinture', items.tincture, 1, [
        { usedItemId: items.herb, quantity: 2 },
        { usedItemId: items.alcohol, quantity: 1 },
      ]),
      // 2 tinctures + 1 herb → 1 remedy
      remedy: await createRecipe('Remède', items.remedy, 1, [
        { usedItemId: items.tincture, quantity: 2 },
        { usedItemId: items.herb, quantity: 1 },
      ]),
      // 1 grain → 2 alcohol
      alcohol: await createRecipe('Alcool', items.alcohol, 2, [{ usedItemId: items.grain, quantity: 1 }]),
    };
  });

  beforeEach(async () => {
    // Each test starts with empty chests and no movements.
    await prisma.stockItemMovement.deleteMany({ where: { itemId: { in: Object.values(items) } } });
    await prisma.stockHistory.deleteMany({ where: { itemId: { in: Object.values(items) } } });
  });

  afterAll(async () => {
    if (!items) return;
    await prisma.stockItemMovement.deleteMany({ where: { itemId: { in: Object.values(items) } } });
    // Items cascade to their stock rows and recipes; chests and category go with the scope.
    await prisma.craftRecipe.deleteMany({ where: scope });
    await prisma.item.deleteMany({ where: scope });
    await prisma.chest.deleteMany({ where: scope });
    await prisma.categoryItem.deleteMany({ where: scope });
  });

  it('consumes the ingredients, adds the product and records the movements', async () => {
    await setStock(items.herb, chestA, 10);
    await setStock(items.alcohol, chestA, 5);

    const result = await craft(recipes.tincture, items.tincture, 3);

    expect(result).toMatchObject({ ok: true, data: { success: true, quantityProduced: 3 } });
    expect(await stock(items.herb, chestA)).toBe(4);
    expect(await stock(items.alcohol, chestA)).toBe(2);
    expect(await stock(items.tincture, chestA)).toBe(3);
    expect(await movements()).toEqual(
      expect.arrayContaining([
        { itemId: items.tincture, chestId: chestA, quantity: 3, kind: 'CRAFT_PRODUCE', userId: USER },
        { itemId: items.herb, chestId: chestA, quantity: -6, kind: 'CRAFT_CONSUME', userId: USER },
        { itemId: items.alcohol, chestId: chestA, quantity: -3, kind: 'CRAFT_CONSUME', userId: USER },
      ]),
    );
    expect(await movements()).toHaveLength(3);
  });

  it('changes nothing when an ingredient is short, and says which one', async () => {
    await setStock(items.herb, chestA, 3);
    await setStock(items.alcohol, chestA, 5);

    const result = await craft(recipes.tincture, items.tincture, 2);

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(result.ok ? null : result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: items.herb, available: 3, required: 4, hasEnough: false }),
        expect.objectContaining({ itemId: items.alcohol, available: 5, required: 2, hasEnough: true }),
      ]),
    );
    expect(await stock(items.herb, chestA)).toBe(3);
    expect(await stock(items.alcohol, chestA)).toBe(5);
    expect(await stock(items.tincture, chestA)).toBe(0);
    expect(await movements()).toHaveLength(0);
  });

  it('takes from the source chest and puts the product in the destination one', async () => {
    await setStock(items.herb, chestA, 4);
    await setStock(items.alcohol, chestA, 2);
    await setStock(items.tincture, chestB, 1);

    expect((await craft(recipes.tincture, items.tincture, 2, { destination: chestB })).ok).toBe(true);

    expect(await stock(items.herb, chestA)).toBe(0);
    expect(await stock(items.alcohol, chestA)).toBe(0);
    expect(await stock(items.tincture, chestA)).toBe(0);
    expect(await stock(items.tincture, chestB)).toBe(3);
  });

  it('takes an ingredient from its own chest when one is given', async () => {
    const recipe = await prisma.craftRecipe.findUniqueOrThrow({
      where: { id: recipes.tincture },
      include: { ingredients: true },
    });
    const alcoholLine = recipe.ingredients.find((ingredient) => ingredient.usedItemId === items.alcohol);
    await setStock(items.herb, chestA, 2);
    await setStock(items.alcohol, chestB, 1);

    const result = await craft(recipes.tincture, items.tincture, 1, {
      ingredientChests: [{ ingredientId: alcoholLine!.id, chestId: chestB }],
    });

    expect(result.ok).toBe(true);
    expect(await stock(items.herb, chestA)).toBe(0);
    expect(await stock(items.alcohol, chestB)).toBe(0);
    expect(await stock(items.tincture, chestA)).toBe(1);
  });

  it('starts from yesterday’s stock when there is none today', async () => {
    await setStock(items.herb, chestA, 6, 'yesterday');
    await setStock(items.alcohol, chestA, 3, 'yesterday');

    expect((await craft(recipes.tincture, items.tincture, 2)).ok).toBe(true);

    expect(await stock(items.herb, chestA)).toBe(2);
    expect(await stock(items.alcohol, chestA)).toBe(1);
    expect(await stock(items.tincture, chestA)).toBe(2);
  });

  it('runs a queue planned by the UI exactly as simulated', async () => {
    // 1 remedy, with its sub-crafts first: 1× alcohol (2), 2× tincture.
    const start = { herb: 5, grain: 3 };
    await setStock(items.herb, chestA, start.herb);
    await setStock(items.grain, chestA, start.grain);

    const queueRecipes = await prisma.craftRecipe.findMany({
      where: { id: { in: Object.values(recipes) } },
      include: { ingredients: { include: { usedItem: true } } },
    });
    const byId = new Map<string, QueueRecipe>(
      queueRecipes.map((recipe) => [
        recipe.id,
        {
          id: recipe.id,
          name: recipe.name,
          craftedItemId: recipe.craftedItemId,
          quantity: recipe.quantity,
          ingredients: recipe.ingredients.map((ingredient) => ({
            usedItemId: ingredient.usedItemId,
            quantity: ingredient.quantity,
            name: ingredient.usedItem.name,
          })),
        },
      ]),
    );
    const line = (id: string, recipeId: string, craftedItemId: string, times: number): CraftQueueEntry => ({
      id,
      recipeId,
      craftedItemId,
      times,
      sourceChestId: chestA,
      destinationChestId: chestA,
    });
    const queue = [
      line('1', recipes.alcohol, items.alcohol, 1),
      line('2', recipes.tincture, items.tincture, 2),
      line('3', recipes.remedy, items.remedy, 1),
    ];

    const plan = planCraftQueue({
      entries: queue,
      getRecipe: (id) => byId.get(id) ?? null,
      stock: { [chestA]: { [items.herb]: start.herb, [items.grain]: start.grain } },
    });
    expect(plan.canCraftAll).toBe(true);

    for (const entry of queue) {
      expect((await craft(entry.recipeId, entry.craftedItemId, entry.times)).ok).toBe(true);
    }

    // herb: 5 − 4 (tinctures) − 1 (remedy); grain: 3 − 1; alcohol: +2 − 2; tincture: +2 − 2.
    expect(await stock(items.herb, chestA)).toBe(0);
    expect(await stock(items.grain, chestA)).toBe(2);
    expect(await stock(items.alcohol, chestA)).toBe(0);
    expect(await stock(items.tincture, chestA)).toBe(0);
    expect(await stock(items.remedy, chestA)).toBe(1);
    // What the plan said to have beforehand is exactly what was used up.
    expect(Object.fromEntries(plan.ingredients.map((i) => [i.itemId, i.toHave]))).toEqual({
      [items.herb]: 5,
      [items.grain]: 1,
      [items.alcohol]: 0,
      [items.tincture]: 0,
    });
  });

  it('counts an ingredient listed twice in a recipe', async () => {
    const doubled = await createRecipe('Teinture double', items.tincture, 1, [
      { usedItemId: items.herb, quantity: 2 },
      { usedItemId: items.herb, quantity: 1 },
    ]);
    await setStock(items.herb, chestA, 4);

    // Needs 3 herbs per craft: 2 crafts (6) must be refused, 1 craft leaves 1.
    expect((await craft(doubled, items.tincture, 2)).ok).toBe(false);
    expect(await stock(items.herb, chestA)).toBe(4);
    expect((await craft(doubled, items.tincture, 1)).ok).toBe(true);
    expect(await stock(items.herb, chestA)).toBe(1);
  });

  it('handles a product that is also an ingredient', async () => {
    // Distillation: 2 alcohol + 1 grain → 3 alcohol.
    const distillation = await createRecipe('Distillation', items.alcohol, 3, [
      { usedItemId: items.alcohol, quantity: 2 },
      { usedItemId: items.grain, quantity: 1 },
    ]);
    await setStock(items.alcohol, chestA, 2);
    await setStock(items.grain, chestA, 1);

    expect((await craft(distillation, items.alcohol, 1)).ok).toBe(true);
    expect(await stock(items.alcohol, chestA)).toBe(3);
    expect(await stock(items.grain, chestA)).toBe(0);
  });

  it('lists the consumed ingredients above the product in the movements', async () => {
    await setStock(items.herb, chestA, 2);
    await setStock(items.alcohol, chestA, 1);
    expect((await craft(recipes.tincture, items.tincture, 1)).ok).toBe(true);

    const listed = await listStockMovements({ ...scope, pageSize: 10 });
    expect(listed.ok && listed.data.items.map((movement) => movement.kind)).toEqual([
      'CRAFT_CONSUME',
      'CRAFT_CONSUME',
      'CRAFT_PRODUCE',
    ]);
  });

  it('never lets two simultaneous crafts use the same stock twice', async () => {
    // Enough for one craft of 2, not for two.
    await setStock(items.herb, chestA, 4);
    await setStock(items.alcohol, chestA, 2);

    const results = await Promise.all([
      craft(recipes.tincture, items.tincture, 2),
      craft(recipes.tincture, items.tincture, 2),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await stock(items.herb, chestA)).toBe(0);
    expect(await stock(items.alcohol, chestA)).toBe(0);
    expect(await stock(items.tincture, chestA)).toBe(2);
  });

  it('serves a burst of crafts one after the other, within the stock', async () => {
    // Enough for 3 crafts of 1: 5 attempts at once, exactly 3 must pass.
    await setStock(items.herb, chestA, 6);
    await setStock(items.alcohol, chestA, 3);

    const results = await Promise.all(Array.from({ length: 5 }, () => craft(recipes.tincture, items.tincture, 1)));

    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(await stock(items.herb, chestA)).toBe(0);
    expect(await stock(items.alcohol, chestA)).toBe(0);
    expect(await stock(items.tincture, chestA)).toBe(3);
  });
});
