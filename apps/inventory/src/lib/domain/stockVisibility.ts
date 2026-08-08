import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';
import type { ChestStockVisibility } from '@/lib/stock/stockVisibility';

export async function getChestStockVisibility(input: {
  scopeType: string;
  scopeId: string;
  chestId: string;
}): Promise<DomainResult<ChestStockVisibility>> {
  const chest = await prisma.chest.findFirst({
    where: { id: input.chestId, ...scopeWhere(input.scopeType, input.scopeId) },
    select: { id: true },
  });
  if (!chest) return err('Coffre introuvable', 404);

  const [hiddenCategories, hiddenItems] = await Promise.all([
    prisma.chestHiddenCategory.findMany({
      where: { chestId: input.chestId },
      select: { categoryId: true },
    }),
    prisma.chestHiddenItem.findMany({
      where: { chestId: input.chestId },
      select: { itemId: true },
    }),
  ]);

  return ok({
    hiddenCategoryIds: hiddenCategories.map((row) => row.categoryId),
    hiddenItemIds: hiddenItems.map((row) => row.itemId),
  });
}

export async function setChestCategoryHidden(input: {
  scopeType: string;
  scopeId: string;
  chestId: string;
  categoryId: string;
  hidden: boolean;
}): Promise<DomainResult<{ ok: true }>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const chest = await prisma.chest.findFirst({
    where: { id: input.chestId, ...where },
    select: { id: true },
  });
  if (!chest) return err('Coffre introuvable', 404);

  const category = await prisma.categoryItem.findFirst({
    where: { id: input.categoryId, ...where },
    select: { id: true },
  });
  if (!category) return err('Catégorie introuvable', 404);

  if (input.hidden) {
    await prisma.chestHiddenCategory.upsert({
      where: {
        chestId_categoryId: {
          chestId: input.chestId,
          categoryId: input.categoryId,
        },
      },
      create: { chestId: input.chestId, categoryId: input.categoryId },
      update: {},
    });
  } else {
    await prisma.chestHiddenCategory.deleteMany({
      where: { chestId: input.chestId, categoryId: input.categoryId },
    });
  }

  return ok({ ok: true });
}

export async function setChestItemHidden(input: {
  scopeType: string;
  scopeId: string;
  chestId: string;
  itemId: string;
  hidden: boolean;
}): Promise<DomainResult<{ ok: true }>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const chest = await prisma.chest.findFirst({
    where: { id: input.chestId, ...where },
    select: { id: true },
  });
  if (!chest) return err('Coffre introuvable', 404);

  const item = await prisma.item.findFirst({
    where: { id: input.itemId, ...where },
    select: { id: true },
  });
  if (!item) return err('Objet introuvable', 404);

  if (input.hidden) {
    await prisma.chestHiddenItem.upsert({
      where: {
        chestId_itemId: {
          chestId: input.chestId,
          itemId: input.itemId,
        },
      },
      create: { chestId: input.chestId, itemId: input.itemId },
      update: {},
    });
  } else {
    await prisma.chestHiddenItem.deleteMany({
      where: { chestId: input.chestId, itemId: input.itemId },
    });
  }

  return ok({ ok: true });
}
