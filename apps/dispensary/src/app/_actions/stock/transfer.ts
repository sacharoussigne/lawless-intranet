'use server';

import { StockMovementKind, type Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { getTodayStart, getTomorrowStart } from '@/lib/date';
import { ensureTodayStockForPairs, ensureTodayStockForAllActiveChests } from '@/lib/stock/ensureTodayStock';

type TransferItem = { itemId: string; quantity: number };

async function transferItemsInTransaction(
  tx: Prisma.TransactionClient,
  dispensaryId: string,
  validItems: TransferItem[],
  sourceChestId: string,
  destinationChestId: string,
  today: Date,
  tomorrow: Date,
  userId: string,
) {
  const pairs = validItems.flatMap(({ itemId }) => [
    { itemId, chestId: sourceChestId },
    { itemId, chestId: destinationChestId },
  ]);

  await ensureTodayStockForAllActiveChests(tx, dispensaryId, { today, tomorrow });
  const ensured = await ensureTodayStockForPairs(tx, dispensaryId, pairs, { today, tomorrow });

  for (const { itemId, quantity } of validItems) {
    if (quantity <= 0) {
      throw new Error(`La quantité à transférer doit être positive pour l'item ${itemId}`);
    }

    const sourceKey = `${itemId}:${sourceChestId}`;
    const destKey = `${itemId}:${destinationChestId}`;
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
        data: {
          itemId,
          chestId: destinationChestId,
          quantity,
        },
      });
      ensured.set(destKey, {
        id: created.id,
        itemId,
        chestId: destinationChestId,
        quantity,
      });
    }

    await tx.stockItemMovement.createMany({
      data: [
        {
          itemId,
          quantity: -quantity,
          kind: StockMovementKind.TRANSFER_OUT,
          chestId: sourceChestId,
          destinationChestId,
          userId,
        },
        {
          itemId,
          quantity,
          kind: StockMovementKind.TRANSFER_IN,
          chestId: destinationChestId,
          destinationChestId: sourceChestId,
          userId,
        },
      ],
    });
  }
}

export async function transferMultipleStock(
  dispensarySlug: string,
  data: {
    sourceChestId: string;
    destinationChestId: string;
    items: TransferItem[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message: 'Permission refusée : vous n\'avez pas la permission de transférer le stock',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { sourceChestId, destinationChestId, items } = data;

    if (sourceChestId === destinationChestId) {
      return {
        status: 400,
        error: 'Le coffre source et le coffre destination doivent être différents',
      };
    }

    const validItems = items.filter((i) => i.quantity > 0);
    if (validItems.length === 0) {
      return {
        status: 400,
        error: 'Aucun item à transférer',
      };
    }

    const today = getTodayStart();
    const tomorrow = getTomorrowStart();
    const userId = ctx.session.user.id;

    await prisma.$transaction(async (tx) => {
      await transferItemsInTransaction(
        tx,
        dispensaryId,
        validItems,
        sourceChestId,
        destinationChestId,
        today,
        tomorrow,
        userId,
      );
    });

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du transfert des items');
  }
}
