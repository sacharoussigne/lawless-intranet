'use server';

import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import {
  type ChestStockVisibility,
} from '@/lib/stock/stockVisibility';

const chestIdSchema = z.string().uuid('ID de coffre invalide');
const categoryIdSchema = z.string().uuid('ID de catégorie invalide');
const itemIdSchema = z.string().uuid('ID d\'objet invalide');

const setHiddenSchema = z.object({
  chestId: chestIdSchema,
  hidden: z.boolean(),
});

async function assertChestInTenant(chestId: string, dispensaryId: string) {
  return prisma.chest.findFirst({
    where: { id: chestId, ...tenantWhere(dispensaryId) },
    select: { id: true },
  });
}

export async function getChestStockVisibility(
  dispensarySlug: string,
  chestId: string,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: { resource: 'stock', action: 'view' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const parsedChestId = chestIdSchema.parse(chestId);

    const chest = await assertChestInTenant(parsedChestId, dispensaryId);
    if (!chest) {
      return { status: 404, error: 'Coffre introuvable' };
    }

    const [hiddenCategories, hiddenItems] = await Promise.all([
      prisma.chestHiddenCategory.findMany({
        where: { chestId: parsedChestId },
        select: { categoryId: true },
      }),
      prisma.chestHiddenItem.findMany({
        where: { chestId: parsedChestId },
        select: { itemId: true },
      }),
    ]);

    const data: ChestStockVisibility = {
      hiddenCategoryIds: hiddenCategories.map((row) => row.categoryId),
      hiddenItemIds: hiddenItems.map((row) => row.itemId),
    };

    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de la visibilité du stock');
  }
}

export async function setChestCategoryHidden(
  dispensarySlug: string,
  input: { chestId: string; categoryId: string; hidden: boolean },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'hide',
        message: 'Permission refusée : vous n\'avez pas la permission de masquer des éléments du stock',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = setHiddenSchema.extend({ categoryId: categoryIdSchema }).parse(input);

    const chest = await assertChestInTenant(validated.chestId, dispensaryId);
    if (!chest) {
      return { status: 404, error: 'Coffre introuvable' };
    }

    const category = await prisma.categoryItem.findFirst({
      where: { id: validated.categoryId, ...tenantWhere(dispensaryId) },
      select: { id: true },
    });
    if (!category) {
      return { status: 404, error: 'Catégorie introuvable' };
    }

    if (validated.hidden) {
      await prisma.chestHiddenCategory.upsert({
        where: {
          chestId_categoryId: {
            chestId: validated.chestId,
            categoryId: validated.categoryId,
          },
        },
        create: {
          chestId: validated.chestId,
          categoryId: validated.categoryId,
        },
        update: {},
      });
    } else {
      await prisma.chestHiddenCategory.deleteMany({
        where: {
          chestId: validated.chestId,
          categoryId: validated.categoryId,
        },
      });
    }

    return { status: 200, data: { ok: true as const } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour de la visibilité de la catégorie');
  }
}

export async function setChestItemHidden(
  dispensarySlug: string,
  input: { chestId: string; itemId: string; hidden: boolean },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'hide',
        message: 'Permission refusée : vous n\'avez pas la permission de masquer des éléments du stock',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = setHiddenSchema.extend({ itemId: itemIdSchema }).parse(input);

    const chest = await assertChestInTenant(validated.chestId, dispensaryId);
    if (!chest) {
      return { status: 404, error: 'Coffre introuvable' };
    }

    const item = await prisma.item.findFirst({
      where: { id: validated.itemId, ...tenantWhere(dispensaryId) },
      select: { id: true },
    });
    if (!item) {
      return { status: 404, error: 'Objet introuvable' };
    }

    if (validated.hidden) {
      await prisma.chestHiddenItem.upsert({
        where: {
          chestId_itemId: {
            chestId: validated.chestId,
            itemId: validated.itemId,
          },
        },
        create: {
          chestId: validated.chestId,
          itemId: validated.itemId,
        },
        update: {},
      });
    } else {
      await prisma.chestHiddenItem.deleteMany({
        where: {
          chestId: validated.chestId,
          itemId: validated.itemId,
        },
      });
    }

    return { status: 200, data: { ok: true as const } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour de la visibilité de l\'objet');
  }
}
