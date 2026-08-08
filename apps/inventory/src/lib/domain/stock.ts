import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';
import { getTodayStart, getTomorrowStart, getStartOfDay, getDayAfter } from '@/lib/date';
import {
  ensureTodayStockForAllActiveChests,
  ensureTodayStockForPairs,
} from '@/lib/stock/ensureTodayStock';
import { buildManualMovements, totalsFromItems, type StockStatsItemRow } from '@/lib/stock/movements';
import { aggregateTodayAndPrevious, type StockHistoryRow } from '@/lib/stock/aggregateStock';
import { resolveChestAccess, hasChestAccess, chestAccessWhereFilter, getDefaultChestId } from '@/lib/chests/access';
import { Prisma } from '@/generated/prisma/client';
import { serializeItem } from '@/lib/serialize';

const ITEM_STOCK_SELECT = {
  id: true,
  name: true,
  description: true,
  minimalQuantity: true,
  isCraftable: true,
  canBeSold: true,
  price: true,
  weight: true,
  categoryId: true,
  companyGroupId: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, color: true, order: true } },
  companyGroup: { select: { id: true, name: true } },
} as const;

async function fetchLatestStockBeforeDate(
  client: Pick<typeof prisma, 'stockHistory'>,
  scopeType: string,
  scopeId: string,
  itemIds: string[],
  beforeDate: Date,
  chestId?: string | null,
  allowedChestIds?: string[] | null,
): Promise<StockHistoryRow[]> {
  if (itemIds.length === 0) return [];
  if (allowedChestIds && allowedChestIds.length === 0) return [];

  const baseWhere = {
    itemId: { in: itemIds },
    timestamp: { lt: beforeDate },
    ...(chestId
      ? { chestId }
      : allowedChestIds
        ? { chestId: { in: allowedChestIds } }
        : {}),
    chest: { isEnabled: true, ...scopeWhere(scopeType, scopeId) },
  };

  const groups = await client.stockHistory.groupBy({
    by: chestId ? ['itemId'] : ['itemId', 'chestId'],
    where: baseWhere,
    _max: { timestamp: true },
  });
  if (groups.length === 0) return [];

  const latestRows = await client.stockHistory.findMany({
    where: {
      OR: groups.map((group) => ({
        itemId: group.itemId,
        ...(!chestId && 'chestId' in group ? { chestId: (group as { chestId: string }).chestId } : {}),
        timestamp: group._max.timestamp!,
        ...(chestId ? { chestId } : {}),
      })),
    },
    select: { itemId: true, chestId: true, quantity: true, timestamp: true },
  });

  const latestByKey = new Map<string, StockHistoryRow>();
  for (const row of latestRows) {
    const key = chestId ? row.itemId : `${row.itemId}:${row.chestId}`;
    const existing = latestByKey.get(key);
    if (!existing || row.timestamp.getTime() > existing.timestamp.getTime()) {
      latestByKey.set(key, row);
    }
  }
  return Array.from(latestByKey.values());
}

async function fetchStockHistoryRows(
  scopeType: string,
  scopeId: string,
  itemIds: string[],
  range: { gte: Date; lt: Date },
  chestId?: string | null,
  allowedChestIds?: string[] | null,
): Promise<StockHistoryRow[]> {
  if (itemIds.length === 0) return [];
  if (allowedChestIds && allowedChestIds.length === 0) return [];

  return prisma.stockHistory.findMany({
    where: {
      itemId: { in: itemIds },
      ...(chestId
        ? { chestId }
        : allowedChestIds
          ? { chestId: { in: allowedChestIds } }
          : {}),
      timestamp: range,
      chest: { isEnabled: true, ...scopeWhere(scopeType, scopeId) },
    },
    select: { itemId: true, chestId: true, quantity: true, timestamp: true },
    orderBy: { timestamp: 'desc' },
  });
}

function latestStockByItem<T extends { itemId: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(row.itemId)) map.set(row.itemId, row);
  }
  return map;
}

export async function queryItemsWithStock(input: {
  scopeType: string;
  scopeId: string;
  chestId?: string | null;
  effectiveRole?: string | null;
}): Promise<DomainResult<unknown>> {
  const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
  if (input.chestId && !hasChestAccess(access, input.chestId)) {
    return err('Accès refusé à ce coffre', 403);
  }

  const allowedChestIds = access.all ? null : access.chestIds;
  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  const items = await prisma.item.findMany({
    where: { isEnabled: true, ...scopeWhere(input.scopeType, input.scopeId) },
    orderBy: { createdAt: 'desc' },
    select: ITEM_STOCK_SELECT,
  });
  const itemIds = items.map((i) => i.id);
  const [todayRows, previousRows] = await Promise.all([
    fetchStockHistoryRows(
      input.scopeType,
      input.scopeId,
      itemIds,
      { gte: today, lt: tomorrow },
      input.chestId,
      allowedChestIds,
    ),
    fetchLatestStockBeforeDate(
      prisma,
      input.scopeType,
      input.scopeId,
      itemIds,
      today,
      input.chestId,
      allowedChestIds,
    ),
  ]);

  const snapshots = aggregateTodayAndPrevious(todayRows, previousRows, today, input.chestId);
  return ok(
    items.map((item) => {
      const snapshot = snapshots.get(item.id);
      return {
        ...serializeItem(item),
        stockToday: snapshot?.stockToday ?? null,
        stockYesterday: snapshot?.stockYesterday ?? null,
        stockPreviousAt: snapshot?.stockPreviousAt ?? null,
      };
    }),
  );
}

export async function queryItemsWithStockForDate(input: {
  scopeType: string;
  scopeId: string;
  date: Date;
  chestId?: string | null;
  effectiveRole?: string | null;
}): Promise<DomainResult<unknown>> {
  if (input.chestId) {
    const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
    if (!hasChestAccess(access, input.chestId)) {
      return err('Accès refusé à ce coffre', 403);
    }
  }

  const dayStart = getStartOfDay(input.date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const items = await prisma.item.findMany({
    where: { isEnabled: true, ...scopeWhere(input.scopeType, input.scopeId) },
    orderBy: { createdAt: 'desc' },
    select: ITEM_STOCK_SELECT,
  });
  const itemIds = items.map((i) => i.id);

  const stockRows =
    itemIds.length > 0
      ? await prisma.stockHistory.findMany({
          where: {
            itemId: { in: itemIds },
            timestamp: { gte: dayStart, lt: dayEnd },
            ...(input.chestId ? { chestId: input.chestId } : {}),
            chest: { isEnabled: true, ...scopeWhere(input.scopeType, input.scopeId) },
          },
          select: { id: true, itemId: true, quantity: true, timestamp: true },
          orderBy: { timestamp: 'desc' },
        })
      : [];

  const latestByItem = new Map<string, { id: string; quantity: number }>();
  for (const row of stockRows) {
    if (!latestByItem.has(row.itemId)) {
      latestByItem.set(row.itemId, { id: row.id, quantity: row.quantity });
    }
  }

  return ok(
    items.map((item) => {
      const stockForDate = latestByItem.get(item.id);
      return {
        ...serializeItem(item),
        stockForDate: stockForDate?.quantity ?? null,
        stockHistoryId: stockForDate?.id ?? null,
      };
    }),
  );
}

export async function queryItemsWithDetailedStock(input: {
  scopeType: string;
  scopeId: string;
  itemIds?: string[];
  effectiveRole?: string | null;
}): Promise<DomainResult<unknown>> {
  const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
  const allowedChestIds = access.all ? null : access.chestIds;
  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  const items = await prisma.item.findMany({
    where: {
      isEnabled: true,
      ...scopeWhere(input.scopeType, input.scopeId),
      ...(input.itemIds?.length ? { id: { in: input.itemIds } } : {}),
    },
    orderBy: { name: 'asc' },
    select: ITEM_STOCK_SELECT,
  });
  const ids = items.map((i) => i.id);
  const [todayRows, previousRows] = await Promise.all([
    fetchStockHistoryRows(input.scopeType, input.scopeId, ids, { gte: today, lt: tomorrow }, null, allowedChestIds),
    fetchLatestStockBeforeDate(prisma, input.scopeType, input.scopeId, ids, today, null, allowedChestIds),
  ]);

  const allChests = await prisma.chest.findMany({
    where: {
      isEnabled: true,
      ...scopeWhere(input.scopeType, input.scopeId),
      ...chestAccessWhereFilter(access),
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return ok(
    items.map((item) => {
      const itemTodayRows = todayRows.filter((r) => r.itemId === item.id);
      const itemPreviousRows = previousRows.filter((r) => r.itemId === item.id);
      const snapshots = aggregateTodayAndPrevious(itemTodayRows, itemPreviousRows, today);

      const stockByChest = allChests.map((chest) => {
        const chestTodayRows = itemTodayRows.filter((r) => r.chestId === chest.id);
        const chestPreviousRows = itemPreviousRows.filter((r) => r.chestId === chest.id);
        const chestSnapshot = aggregateTodayAndPrevious(
          chestTodayRows,
          chestPreviousRows,
          today,
          chest.id,
        ).get(item.id);
        return {
          chestId: chest.id,
          chestName: chest.name,
          stockToday: chestSnapshot?.stockToday ?? null,
          stockYesterday: chestSnapshot?.stockYesterday ?? null,
          stockPreviousAt: chestSnapshot?.stockPreviousAt ?? null,
        };
      });

      const aggregate = snapshots.get(item.id);
      return {
        ...serializeItem(item),
        stockToday: aggregate?.stockToday ?? null,
        stockYesterday: aggregate?.stockYesterday ?? null,
        stockPreviousAt: aggregate?.stockPreviousAt ?? null,
        stockByChest,
      };
    }),
  );
}

export async function getLastStockDaysByChest(input: {
  scopeType: string;
  scopeId: string;
  effectiveRole?: string | null;
}): Promise<DomainResult<Record<string, string | null>>> {
  const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
  if (!access.all && access.chestIds.length === 0) return ok({});

  const chests = await prisma.chest.findMany({
    where: {
      isEnabled: true,
      ...scopeWhere(input.scopeType, input.scopeId),
      ...chestAccessWhereFilter(access),
    },
    select: { id: true },
  });
  const chestIds = chests.map((c) => c.id);
  const today = getTodayStart();
  const result: Record<string, string | null> = Object.fromEntries(
    chestIds.map((id) => [id, null]),
  );

  if (chestIds.length === 0) return ok(result);

  const groups = await prisma.stockHistory.groupBy({
    by: ['chestId'],
    where: {
      chestId: { in: chestIds },
      timestamp: { lt: today },
      chest: { isEnabled: true, ...scopeWhere(input.scopeType, input.scopeId) },
    },
    _max: { timestamp: true },
  });

  for (const group of groups) {
    if (group._max.timestamp) {
      result[group.chestId] = getStartOfDay(group._max.timestamp).toISOString();
    }
  }
  return ok(result);
}

export async function updateStock(input: {
  scopeType: string;
  scopeId: string;
  stocks: { itemId: string; quantity: number }[];
  chestId?: string | null;
  skipHistory?: boolean;
  userId?: string | null;
  effectiveRole?: string | null;
}): Promise<DomainResult<unknown>> {
  if (input.stocks.length === 0) return ok([]);

  let targetChestId = input.chestId;
  if (!targetChestId) {
    try {
      targetChestId = await getDefaultChestId(input.scopeType, input.scopeId);
    } catch {
      return err('Coffre par défaut "Foure tout" non trouvé ou désactivé', 404);
    }
  }

  const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
  if (!hasChestAccess(access, targetChestId)) {
    return err('Accès refusé à ce coffre', 403);
  }

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();
  const itemIds = input.stocks.map((d) => d.itemId);
  const resolvedChestId = targetChestId;

  const results = await prisma.$transaction(async (tx) => {
    const [todayRows, previousRows] = await Promise.all([
      tx.stockHistory.findMany({
        where: {
          itemId: { in: itemIds },
          chestId: resolvedChestId,
          timestamp: { gte: today, lt: tomorrow },
        },
        orderBy: { timestamp: 'desc' },
      }),
      fetchLatestStockBeforeDate(tx, input.scopeType, input.scopeId, itemIds, today, resolvedChestId),
    ]);

    const todayByItem = latestStockByItem(todayRows);
    const previousByItem = new Map(previousRows.map((row) => [row.itemId, row]));

    const stockResults = await Promise.all(
      input.stocks.map(async ({ itemId, quantity }) => {
        const existingStock = todayByItem.get(itemId);
        if (existingStock) {
          return tx.stockHistory.update({
            where: { id: existingStock.id },
            data: { quantity },
          });
        }
        return tx.stockHistory.create({
          data: { itemId, chestId: resolvedChestId, quantity },
        });
      }),
    );

    const movements = buildManualMovements(
      input.stocks.map(({ itemId, quantity }) => ({
        itemId,
        newQty: quantity,
        stockToday: todayByItem.get(itemId)?.quantity ?? null,
        stockYesterday: previousByItem.get(itemId)?.quantity ?? null,
      })),
      input.skipHistory ?? false,
      resolvedChestId,
    );

    if (movements.length > 0) {
      await tx.stockItemMovement.createMany({
        data: movements.map((m) => ({
          itemId: m.itemId,
          quantity: m.quantity,
          kind: m.kind,
          chestId: resolvedChestId,
          userId: input.userId ?? null,
        })),
      });
    }

    return stockResults;
  });

  return ok(results);
}

export async function craftItem(input: {
  scopeType: string;
  scopeId: string;
  craftedItemId: string;
  recipeId: string;
  times: number;
  sourceChestId?: string | null;
  ingredientChests: { ingredientId: string; chestId: string }[];
  destinationChestId?: string | null;
  userId?: string | null;
  effectiveRole?: string | null;
}): Promise<DomainResult<unknown>> {
  let destinationChestId = input.destinationChestId;
  if (!destinationChestId) {
    try {
      destinationChestId = await getDefaultChestId(input.scopeType, input.scopeId);
    } catch {
      return err('Coffre par défaut "Foure tout" non trouvé ou désactivé', 404);
    }
  }

  const recipe = await prisma.craftRecipe.findFirst({
    where: { id: input.recipeId, ...scopeWhere(input.scopeType, input.scopeId) },
    include: { ingredients: true },
  });
  if (!recipe) return err('Recette non trouvée', 404);

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();
  const totalQuantityProduced = recipe.quantity * input.times;

  const ingredientChestMap = new Map(
    input.ingredientChests.map(({ ingredientId, chestId }) => [ingredientId, chestId]),
  );

  const ingredientRequirements = recipe.ingredients.map((ingredient) => {
    const sourceChestId = ingredientChestMap.get(ingredient.id) || input.sourceChestId;
    return {
      ingredient,
      requiredQuantity: ingredient.quantity * input.times,
      sourceChestId,
    };
  });

  const missingChest = ingredientRequirements.find((r) => !r.sourceChestId);
  if (missingChest) {
    return err('Stock insuffisant pour certains ingrédients', 400, [
      {
        itemId: missingChest.ingredient.usedItemId,
        ingredientId: missingChest.ingredient.id,
        available: 0,
        required: missingChest.requiredQuantity,
        hasEnough: false,
        error: 'Aucun coffre source sélectionné',
      },
    ]);
  }

  const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
  const craftChestIds = [
    destinationChestId,
    ...ingredientRequirements.map((r) => r.sourceChestId!).filter(Boolean),
  ];
  if (craftChestIds.some((id) => !hasChestAccess(access, id))) {
    return err('Accès refusé à un ou plusieurs coffres', 403);
  }

  const stockLookups = [
    ...ingredientRequirements.map((r) => ({
      itemId: r.ingredient.usedItemId,
      chestId: r.sourceChestId!,
    })),
    { itemId: input.craftedItemId, chestId: destinationChestId },
  ];
  const stockKey = (itemId: string, chestId: string) => `${itemId}:${chestId}`;

  const craftResult = await prisma.$transaction(async (tx) => {
    await ensureTodayStockForAllActiveChests(tx, input.scopeType, input.scopeId, { today, tomorrow });
    const ensured = await ensureTodayStockForPairs(tx, input.scopeType, input.scopeId, stockLookups, {
      today,
      tomorrow,
    });

    const ingredientChecks = ingredientRequirements.map(
      ({ ingredient, requiredQuantity, sourceChestId }) => {
        const availableStock =
          ensured.get(stockKey(ingredient.usedItemId, sourceChestId!))?.quantity ?? 0;
        return {
          itemId: ingredient.usedItemId,
          ingredientId: ingredient.id,
          available: availableStock,
          required: requiredQuantity,
          hasEnough: availableStock >= requiredQuantity,
        };
      },
    );

    if (!ingredientChecks.every((check) => check.hasEnough)) {
      return { ok: false as const, ingredientChecks };
    }

    const craftedStock = ensured.get(stockKey(input.craftedItemId, destinationChestId!));
    if (craftedStock) {
      await tx.stockHistory.update({
        where: { id: craftedStock.id },
        data: { quantity: craftedStock.quantity + totalQuantityProduced },
      });
    } else {
      await tx.stockHistory.create({
        data: {
          itemId: input.craftedItemId,
          chestId: destinationChestId!,
          quantity: totalQuantityProduced,
        },
      });
    }

    for (const { ingredient, requiredQuantity, sourceChestId } of ingredientRequirements) {
      const existing = ensured.get(stockKey(ingredient.usedItemId, sourceChestId!));
      if (existing) {
        await tx.stockHistory.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity - requiredQuantity },
        });
      } else {
        await tx.stockHistory.create({
          data: {
            itemId: ingredient.usedItemId,
            chestId: sourceChestId!,
            quantity: -requiredQuantity,
          },
        });
      }
    }

    await tx.stockItemMovement.createMany({
      data: [
        {
          itemId: input.craftedItemId,
          quantity: totalQuantityProduced,
          kind: 'CRAFT_PRODUCE',
          chestId: destinationChestId,
          userId: input.userId ?? null,
        },
        ...ingredientRequirements.map(({ ingredient, requiredQuantity, sourceChestId }) => ({
          itemId: ingredient.usedItemId,
          quantity: -requiredQuantity,
          kind: 'CRAFT_CONSUME' as const,
          chestId: sourceChestId,
          userId: input.userId ?? null,
        })),
      ],
    });

    return { ok: true as const };
  });

  if (!craftResult.ok) {
    return err('Stock insuffisant pour certains ingrédients', 400, craftResult.ingredientChecks);
  }

  return ok({ success: true, quantityProduced: totalQuantityProduced });
}

export async function transferStock(input: {
  scopeType: string;
  scopeId: string;
  sourceChestId: string;
  destinationChestId: string;
  items: { itemId: string; quantity: number }[];
  userId?: string | null;
  effectiveRole?: string | null;
}): Promise<DomainResult<{ success: true }>> {
  if (input.sourceChestId === input.destinationChestId) {
    return err('Le coffre source et le coffre destination doivent être différents', 400);
  }

  const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
  if (
    !hasChestAccess(access, input.sourceChestId) ||
    !hasChestAccess(access, input.destinationChestId)
  ) {
    return err('Accès refusé à un ou plusieurs coffres', 403);
  }

  const validItems = input.items.filter((i) => i.quantity > 0);
  if (validItems.length === 0) return err('Aucun item à transférer', 400);

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  try {
    await prisma.$transaction(async (tx) => {
      const pairs = validItems.flatMap(({ itemId }) => [
        { itemId, chestId: input.sourceChestId },
        { itemId, chestId: input.destinationChestId },
      ]);
      await ensureTodayStockForAllActiveChests(tx, input.scopeType, input.scopeId, {
        today,
        tomorrow,
      });
      const ensured = await ensureTodayStockForPairs(tx, input.scopeType, input.scopeId, pairs, {
        today,
        tomorrow,
      });

      for (const { itemId, quantity } of validItems) {
        const sourceKey = `${itemId}:${input.sourceChestId}`;
        const destKey = `${itemId}:${input.destinationChestId}`;
        const sourceStock = ensured.get(sourceKey);
        if (!sourceStock) {
          throw new Error(`Aucun stock trouvé dans le coffre source pour l'item ${itemId}`);
        }
        if (sourceStock.quantity < quantity) {
          throw new Error(
            `Stock insuffisant dans le coffre source pour l'item ${itemId}. Stock disponible: ${sourceStock.quantity}, quantité demandée: ${quantity}`,
          );
        }

        await tx.stockHistory.update({
          where: { id: sourceStock.id },
          data: { quantity: sourceStock.quantity - quantity },
        });
        sourceStock.quantity -= quantity;

        const destinationStock = ensured.get(destKey);
        if (destinationStock) {
          await tx.stockHistory.update({
            where: { id: destinationStock.id },
            data: { quantity: destinationStock.quantity + quantity },
          });
          destinationStock.quantity += quantity;
        } else {
          const created = await tx.stockHistory.create({
            data: { itemId, chestId: input.destinationChestId, quantity },
          });
          ensured.set(destKey, {
            id: created.id,
            itemId,
            chestId: input.destinationChestId,
            quantity,
          });
        }

        await tx.stockItemMovement.createMany({
          data: [
            {
              itemId,
              quantity: -quantity,
              kind: 'TRANSFER_OUT',
              chestId: input.sourceChestId,
              destinationChestId: input.destinationChestId,
              userId: input.userId ?? null,
            },
            {
              itemId,
              quantity,
              kind: 'TRANSFER_IN',
              chestId: input.destinationChestId,
              destinationChestId: input.sourceChestId,
              userId: input.userId ?? null,
            },
          ],
        });
      }
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Erreur lors du transfert', 400);
  }

  return ok({ success: true });
}

export async function moveItemsWithChests(input: {
  scopeType: string;
  scopeId: string;
  mode: 'take' | 'deposit';
  items: { itemId: string; quantity: number; chestId: string }[];
  userId?: string | null;
  effectiveRole?: string | null;
}): Promise<DomainResult<unknown>> {
  const isTake = input.mode === 'take';
  const validItems = input.items.filter((item) => item.quantity > 0 && item.chestId);
  if (validItems.length === 0) {
    return err(`Aucun objet à ${isTake ? 'prendre' : 'déposer'}`, 400);
  }

  const itemIds = Array.from(new Set(validItems.map((i) => i.itemId)));
  const chestIds = Array.from(new Set(validItems.map((i) => i.chestId)));

  const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
  if (chestIds.some((chestId) => !hasChestAccess(access, chestId))) {
    return err('Accès refusé à un ou plusieurs coffres', 403);
  }

  const [items, chests] = await Promise.all([
    prisma.item.findMany({
      where: {
        id: { in: itemIds },
        isEnabled: true,
        ...scopeWhere(input.scopeType, input.scopeId),
      },
      select: { id: true },
    }),
    prisma.chest.findMany({
      where: {
        id: { in: chestIds },
        isEnabled: true,
        ...scopeWhere(input.scopeType, input.scopeId),
      },
      select: { id: true },
    }),
  ]);
  if (items.length !== itemIds.length) return err('Un ou plusieurs objets sont invalides', 400);
  if (chests.length !== chestIds.length) return err('Un ou plusieurs coffres sont invalides', 400);

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  try {
    await prisma.$transaction(async (tx) => {
      await ensureTodayStockForAllActiveChests(tx, input.scopeType, input.scopeId, {
        today,
        tomorrow,
      });
      const ensured = await ensureTodayStockForPairs(
        tx,
        input.scopeType,
        input.scopeId,
        validItems.map((item) => ({ itemId: item.itemId, chestId: item.chestId })),
        { today, tomorrow },
      );

      for (const item of validItems) {
        const key = `${item.itemId}:${item.chestId}`;
        const stock = ensured.get(key);

        if (isTake) {
          if (!stock) throw new Error(`Aucun stock trouvé pour l'objet dans le coffre sélectionné`);
          if (stock.quantity < item.quantity) {
            throw new Error(
              `Stock insuffisant (disponible: ${stock.quantity}, demandé: ${item.quantity})`,
            );
          }
          await tx.stockHistory.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity - item.quantity },
          });
          stock.quantity -= item.quantity;
        } else if (stock) {
          await tx.stockHistory.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity + item.quantity },
          });
          stock.quantity += item.quantity;
        } else {
          const created = await tx.stockHistory.create({
            data: {
              itemId: item.itemId,
              chestId: item.chestId,
              quantity: item.quantity,
            },
          });
          ensured.set(key, {
            id: created.id,
            itemId: item.itemId,
            chestId: item.chestId,
            quantity: item.quantity,
          });
        }
      }

      await tx.stockItemMovement.createMany({
        data: validItems.map((item) => ({
          itemId: item.itemId,
          quantity: isTake ? -item.quantity : item.quantity,
          kind: isTake ? 'TAKE_OUT' : 'DEPOSIT_IN',
          chestId: item.chestId,
          userId: input.userId ?? null,
        })),
      });
    });
  } catch (error) {
    return err(
      error instanceof Error
        ? error.message
        : isTake
          ? "Erreur lors de la prise d'objets"
          : "Erreur lors du dépôt d'objets",
      400,
    );
  }

  return ok({ success: true, count: validItems.length, mode: input.mode });
}

export async function overwriteStockForDate(input: {
  scopeType: string;
  scopeId: string;
  date: Date;
  stocks: { itemId: string; quantity: number }[];
  chestId?: string | null;
}): Promise<DomainResult<{ count: number }>> {
  const dayStart = getStartOfDay(input.date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  let targetChestId = input.chestId;
  if (!targetChestId) {
    try {
      targetChestId = await getDefaultChestId(input.scopeType, input.scopeId);
    } catch {
      return err('Coffre par défaut "Foure tout" non trouvé ou désactivé', 404);
    }
  }

  const stocksToWrite = input.stocks.filter(
    (stock) => stock.quantity !== null && stock.quantity !== undefined,
  );

  await prisma.$transaction(async (tx) => {
    await tx.stockHistory.deleteMany({
      where: {
        timestamp: { gte: dayStart, lt: dayEnd },
        chestId: targetChestId!,
        chest: scopeWhere(input.scopeType, input.scopeId),
      },
    });

    if (stocksToWrite.length > 0) {
      await tx.stockHistory.createMany({
        data: stocksToWrite.map(({ itemId, quantity }) => ({
          itemId,
          chestId: targetChestId!,
          quantity,
          timestamp: dayStart,
        })),
      });
    }
  });

  return ok({ count: stocksToWrite.length });
}

export async function getStockConsumptionStats(input: {
  scopeType: string;
  scopeId: string;
  from: Date;
  to: Date;
}): Promise<DomainResult<{ items: StockStatsItemRow[]; totals: { consumed: number; added: number; net: number } }>> {
  const fromStart = getStartOfDay(input.from);
  const toEndExclusive = getDayAfter(getStartOfDay(input.to));
  if (fromStart >= toEndExclusive) {
    return err('La date de début doit être antérieure à la date de fin', 400);
  }

  const rows = await prisma.$queryRaw<
    Array<{
      itemId: string;
      itemName: string;
      categoryId: string;
      categoryName: string;
      consumed: number;
      added: number;
      net: number;
    }>
  >(Prisma.sql`
    SELECT
      i.id AS "itemId",
      i.name AS "itemName",
      i."categoryId" AS "categoryId",
      c.name AS "categoryName",
      COALESCE(SUM(CASE WHEN m.quantity < 0 THEN -m.quantity ELSE 0 END), 0)::int AS consumed,
      COALESCE(SUM(CASE WHEN m.quantity > 0 THEN m.quantity ELSE 0 END), 0)::int AS added,
      COALESCE(SUM(m.quantity), 0)::int AS net
    FROM stock_item_movement m
    INNER JOIN item i ON i.id = m."itemId"
    INNER JOIN category_item c ON c.id = i."categoryId"
    WHERE m."createdAt" >= ${fromStart}
      AND m."createdAt" < ${toEndExclusive}
      AND i."isEnabled" = true
      AND i."scopeType" = ${input.scopeType}
      AND i."scopeId" = ${input.scopeId}
    GROUP BY i.id, i.name, i."categoryId", c.name
  `);

  const items: StockStatsItemRow[] = rows.map((row) => ({
    itemId: row.itemId,
    itemName: row.itemName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    consumed: row.consumed,
    added: row.added,
    net: row.net,
  }));

  return ok({ items, totals: totalsFromItems(items) });
}
