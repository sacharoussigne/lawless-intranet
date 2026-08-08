import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';

export type ChestStockCheckConfigDTO = {
  chestId: string;
  isEnabled: boolean;
  categoryIds: string[];
};

export async function getChestStockCheckConfigs(scopeType: string, scopeId: string) {
  const where = scopeWhere(scopeType, scopeId);
  const [chests, categories, configs] = await Promise.all([
    prisma.chest.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, isEnabled: true, order: true },
    }),
    prisma.categoryItem.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true, order: true },
    }),
    prisma.chestStockCheckConfig.findMany({
      where: { chest: where },
      select: {
        chestId: true,
        isEnabled: true,
        categories: { select: { categoryId: true } },
      },
    }),
  ]);

  const configsByChestId: Record<string, ChestStockCheckConfigDTO> = Object.fromEntries(
    configs.map((c) => [
      c.chestId,
      {
        chestId: c.chestId,
        isEnabled: c.isEnabled,
        categoryIds: c.categories.map((x) => x.categoryId),
      },
    ]),
  );

  return ok({ chests, categories, configsByChestId });
}

export async function getStockChecksSummary(scopeType: string, scopeId: string) {
  const where = scopeWhere(scopeType, scopeId);
  const [enabledChests, configs] = await Promise.all([
    prisma.chest.findMany({
      where: { isEnabled: true, ...where },
      select: { id: true },
    }),
    prisma.chestStockCheckConfig.findMany({
      where: { chest: where },
      select: {
        chestId: true,
        isEnabled: true,
        categories: { select: { categoryId: true } },
      },
    }),
  ]);

  const configsByChestId: Record<string, ChestStockCheckConfigDTO> = Object.fromEntries(
    configs.map((c) => [
      c.chestId,
      {
        chestId: c.chestId,
        isEnabled: c.isEnabled,
        categoryIds: c.categories.map((x) => x.categoryId),
      },
    ]),
  );

  return ok({
    enabledChestIds: enabledChests.map((c) => c.id),
    configsByChestId,
  });
}

export async function upsertChestStockCheckConfig(input: {
  scopeType: string;
  scopeId: string;
  chestId: string;
  isEnabled: boolean;
  categoryIds: string[];
}): Promise<DomainResult<unknown>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const chest = await prisma.chest.findFirst({
    where: { id: input.chestId, ...where },
  });
  if (!chest) return err('Coffre introuvable', 404);

  const uniqueCategoryIds = Array.from(new Set(input.categoryIds));
  if (uniqueCategoryIds.length > 0) {
    const categories = await prisma.categoryItem.findMany({
      where: { id: { in: uniqueCategoryIds }, ...where },
      select: { id: true },
    });
    if (categories.length !== uniqueCategoryIds.length) {
      return err('Une ou plusieurs catégories sont invalides', 400);
    }
  }

  const config = await prisma.$transaction(async (tx) => {
    const upserted = await tx.chestStockCheckConfig.upsert({
      where: { chestId: input.chestId },
      create: { chestId: input.chestId, isEnabled: input.isEnabled },
      update: { isEnabled: input.isEnabled },
      select: { id: true, chestId: true, isEnabled: true },
    });

    await tx.chestStockCheckCategory.deleteMany({ where: { configId: upserted.id } });

    if (uniqueCategoryIds.length > 0) {
      await tx.chestStockCheckCategory.createMany({
        data: uniqueCategoryIds.map((categoryId) => ({
          configId: upserted.id,
          categoryId,
        })),
      });
    }

    return upserted;
  });

  return ok(config);
}
