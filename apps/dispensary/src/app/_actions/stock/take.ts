'use server';

import { StockMovementKind } from '@prisma/client';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { getTodayStart, getTomorrowStart } from '@/lib/date';
import { ensureTodayStockForPairs, ensureTodayStockForAllActiveChests } from '@/lib/stock/ensureTodayStock';

export type TakeStockItemInput = {
  itemId: string;
  quantity: number;
  chestId: string;
};

export async function takeItemsFromChests(
  dispensarySlug: string,
  data: {
    items: TakeStockItemInput[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message: 'Permission refusée : vous n\'avez pas la permission de prendre du stock',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;
    const userId = ctx.session.user.id;

    const validItems = data.items.filter((item) => item.quantity > 0 && item.chestId);
    if (validItems.length === 0) {
      return { status: 400, error: 'Aucun objet à prendre' };
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
      }

      await tx.stockItemMovement.createMany({
        data: validItems.map((item) => ({
          itemId: item.itemId,
          quantity: -item.quantity,
          kind: StockMovementKind.TAKE_OUT,
          chestId: item.chestId,
          userId,
        })),
      });
    });

    return {
      status: 200,
      data: { success: true, count: validItems.length },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la prise d\'objets');
  }
}
