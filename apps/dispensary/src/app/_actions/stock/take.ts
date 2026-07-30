'use server';

import { StockMovementKind } from '@prisma/client';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { getTodayStart, getTomorrowStart } from '@/lib/date';
import { ensureTodayStockForPairs, ensureTodayStockForAllActiveChests } from '@/lib/stock/ensureTodayStock';

export type ChestStockMoveMode = 'take' | 'deposit';

export type ChestStockMoveItemInput = {
  itemId: string;
  quantity: number;
  chestId: string;
};

export async function moveItemsWithChests(
  dispensarySlug: string,
  data: {
    mode: ChestStockMoveMode;
    items: ChestStockMoveItemInput[];
  },
) {
  const isTake = data.mode === 'take';
  const actionLabel = isTake ? 'prendre' : 'déposer';

  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message: `Permission refusée : vous n'avez pas la permission de ${actionLabel} du stock`,
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;
    const userId = ctx.session.user.id;

    const validItems = data.items.filter((item) => item.quantity > 0 && item.chestId);
    if (validItems.length === 0) {
      return { status: 400, error: `Aucun objet à ${actionLabel}` };
    }

    const itemIds = Array.from(new Set(validItems.map((item) => item.itemId)));
    const chestIds = Array.from(new Set(validItems.map((item) => item.chestId)));

    const [items, chests] = await Promise.all([
      prisma.item.findMany({
        where: {
          id: { in: itemIds },
          isEnabled: true,
          ...tenantWhere(dispensaryId),
        },
        select: { id: true },
      }),
      prisma.chest.findMany({
        where: {
          id: { in: chestIds },
          isEnabled: true,
          ...tenantWhere(dispensaryId),
        },
        select: { id: true },
      }),
    ]);

    if (items.length !== itemIds.length) {
      return { status: 400, error: 'Un ou plusieurs objets sont invalides' };
    }
    if (chests.length !== chestIds.length) {
      return { status: 400, error: 'Un ou plusieurs coffres sont invalides' };
    }

    const today = getTodayStart();
    const tomorrow = getTomorrowStart();

    await prisma.$transaction(async (tx) => {
      await ensureTodayStockForAllActiveChests(tx, dispensaryId, { today, tomorrow });
      const ensured = await ensureTodayStockForPairs(
        tx,
        dispensaryId,
        validItems.map((item) => ({ itemId: item.itemId, chestId: item.chestId })),
        { today, tomorrow },
      );

      for (const item of validItems) {
        const key = `${item.itemId}:${item.chestId}`;
        const stock = ensured.get(key);

        if (isTake) {
          if (!stock) {
            throw new Error(`Aucun stock trouvé pour l'objet dans le coffre sélectionné`);
          }
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
          kind: isTake ? StockMovementKind.TAKE_OUT : StockMovementKind.DEPOSIT_IN,
          chestId: item.chestId,
          userId,
        })),
      });
    });

    return {
      status: 200,
      data: { success: true, count: validItems.length, mode: data.mode },
    };
  } catch (error) {
    return actionErrorParser(
      error,
      isTake ? 'Erreur lors de la prise d\'objets' : 'Erreur lors du dépôt d\'objets',
    );
  }
}

/** @deprecated Prefer moveItemsWithChests({ mode: 'take', ... }) */
export async function takeItemsFromChests(
  dispensarySlug: string,
  data: { items: ChestStockMoveItemInput[] },
) {
  return moveItemsWithChests(dispensarySlug, { mode: 'take', items: data.items });
}
