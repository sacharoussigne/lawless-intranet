import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';
import { getTodayStart, getTomorrowStart } from '@/lib/date';
import { getWeekBounds } from '@/lib/weekBounds';
import {
  ensureTodayStockForAllActiveChests,
  ensureTodayStockForPairs,
} from '@/lib/stock/ensureTodayStock';
import { getSaleEffectiveTotal } from '@/lib/pricing';
import { resolveChestAccess, hasChestAccess } from '@/lib/chests/access';
import { decimalToNumber } from '@/lib/serialize';
import type { SaleItemSource, SaleStatus } from '@/generated/prisma/client';

export type SaleListItem = {
  id: string;
  userId: string;
  status: SaleStatus;
  createdAt: string;
  cancelledAt: string | null;
  depositedInCashRegister: boolean;
  depositedInCashRegisterAt: string | null;
  customerName: string | null;
  description: string | null;
  priceAdjustment: number;
  subtotalAmount: number;
  totalAmount: number;
  totalQuantity: number;
  items: {
    id: string;
    itemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number | null;
    source: SaleItemSource;
    chestId: string | null;
    chestName: string | null;
  }[];
};

function mapSaleRow(sale: {
  id: string;
  userId: string;
  status: SaleStatus;
  createdAt: Date;
  cancelledAt: Date | null;
  depositedInCashRegister: boolean;
  depositedInCashRegisterAt: Date | null;
  customerName: string | null;
  description: string | null;
  priceAdjustment: unknown;
  items: {
    id: string;
    itemId: string;
    quantity: number;
    unitPrice: unknown;
    source: SaleItemSource;
    chestId: string | null;
    item: { name: string };
    chest: { name: string } | null;
  }[];
}): SaleListItem {
  const items = sale.items.map((item) => ({
    id: item.id,
    itemId: item.itemId,
    itemName: item.item.name,
    quantity: item.quantity,
    unitPrice: decimalToNumber(item.unitPrice),
    source: item.source,
    chestId: item.chestId,
    chestName: item.chest?.name ?? null,
  }));

  const subtotalAmount = items.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
    0,
  );
  const priceAdjustment = Number(sale.priceAdjustment ?? 0);
  const totalAmount = getSaleEffectiveTotal(subtotalAmount, priceAdjustment);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: sale.id,
    userId: sale.userId,
    status: sale.status,
    createdAt: sale.createdAt.toISOString(),
    cancelledAt: sale.cancelledAt?.toISOString() ?? null,
    depositedInCashRegister: sale.depositedInCashRegister,
    depositedInCashRegisterAt: sale.depositedInCashRegisterAt?.toISOString() ?? null,
    customerName: sale.customerName,
    description: sale.description,
    priceAdjustment,
    subtotalAmount,
    totalAmount,
    totalQuantity,
    items,
  };
}

export async function createSale(input: {
  scopeType: string;
  scopeId: string;
  userId: string;
  defaultChestId?: string | null;
  customerName?: string | null;
  description?: string | null;
  individualCustomerId?: string | null;
  priceAdjustment?: number;
  items: {
    itemId: string;
    quantity: number;
    source: SaleItemSource;
    chestId?: string | null;
  }[];
  effectiveRole?: string | null;
}): Promise<DomainResult<SaleListItem>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const customerName = input.customerName?.trim() || null;
  const description = input.description?.trim() || null;
  const priceAdjustment = input.priceAdjustment ?? 0;
  let individualCustomerId = input.individualCustomerId ?? null;

  if (individualCustomerId) {
    const linked = await prisma.individualCustomer.findFirst({
      where: { id: individualCustomerId, ...where },
      select: { id: true, name: true },
    });
    if (!linked) return err('Client introuvable', 400);
    if (customerName && linked.name.trim().toLowerCase() !== customerName.toLowerCase()) {
      individualCustomerId = null;
    }
  }

  if (!individualCustomerId && customerName) {
    const match = await prisma.individualCustomer.findFirst({
      where: {
        ...where,
        name: { equals: customerName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    individualCustomerId = match?.id ?? null;
  }

  const normalizedItems = input.items.map((item) => {
    const chestId =
      item.source === 'CHEST' ? item.chestId || input.defaultChestId || null : null;
    return { ...item, chestId };
  });

  for (const item of normalizedItems) {
    if (item.source === 'CHEST' && !item.chestId) {
      return err("Un coffre est requis pour les objets provenant d'un coffre", 400);
    }
  }

  const itemIds = Array.from(new Set(normalizedItems.map((item) => item.itemId)));
  const items = await prisma.item.findMany({
    where: {
      id: { in: itemIds },
      isEnabled: true,
      canBeSold: true,
      ...where,
    },
    select: { id: true, price: true, name: true },
  });
  if (items.length !== itemIds.length) {
    return err('Un ou plusieurs objets ne sont pas vendables', 400);
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  const subtotal = normalizedItems.reduce((sum, line) => {
    const catalogPrice = itemById.get(line.itemId)?.price;
    const unitPrice = catalogPrice != null ? Number(catalogPrice) : 0;
    return sum + unitPrice * line.quantity;
  }, 0);
  if (priceAdjustment < -subtotal) {
    return err('Le total ne peut pas être négatif', 400);
  }

  const chestIds = Array.from(
    new Set(
      normalizedItems
        .filter((item) => item.source === 'CHEST' && item.chestId)
        .map((item) => item.chestId!),
    ),
  );

  if (chestIds.length > 0) {
    const access = await resolveChestAccess(input.scopeType, input.scopeId, input.effectiveRole);
    if (chestIds.some((chestId) => !hasChestAccess(access, chestId))) {
      return err('Accès refusé à un ou plusieurs coffres', 403);
    }
    const chests = await prisma.chest.findMany({
      where: { id: { in: chestIds }, isEnabled: true, ...where },
      select: { id: true },
    });
    if (chests.length !== chestIds.length) {
      return err('Un ou plusieurs coffres sont invalides', 400);
    }
  }

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  try {
    const sale = await prisma.$transaction(async (tx) => {
      await ensureTodayStockForAllActiveChests(tx, input.scopeType, input.scopeId, {
        today,
        tomorrow,
      });

      const chestLines = normalizedItems.filter(
        (item) => item.source === 'CHEST' && item.chestId,
      );

      if (chestLines.length > 0) {
        const ensured = await ensureTodayStockForPairs(
          tx,
          input.scopeType,
          input.scopeId,
          chestLines.map((item) => ({ itemId: item.itemId, chestId: item.chestId! })),
          { today, tomorrow },
        );

        for (const line of chestLines) {
          const key = `${line.itemId}:${line.chestId}`;
          const stock = ensured.get(key);
          if (!stock) {
            throw new Error(
              `Stock introuvable pour ${itemById.get(line.itemId)?.name ?? line.itemId}`,
            );
          }
          if (stock.quantity < line.quantity) {
            throw new Error(
              `Stock insuffisant pour ${itemById.get(line.itemId)?.name ?? line.itemId} (disponible: ${stock.quantity})`,
            );
          }
          await tx.stockHistory.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity - line.quantity },
          });
          stock.quantity -= line.quantity;
        }

        await tx.stockItemMovement.createMany({
          data: chestLines.map((line) => ({
            itemId: line.itemId,
            quantity: -line.quantity,
            kind: 'SALE_OUT',
            chestId: line.chestId,
            userId: input.userId,
          })),
        });
      }

      return tx.sale.create({
        data: {
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          userId: input.userId,
          status: 'COMPLETED',
          customerName,
          description,
          individualCustomerId,
          priceAdjustment,
          items: {
            create: normalizedItems.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              unitPrice: itemById.get(line.itemId)?.price ?? null,
              source: line.source,
              chestId: line.chestId,
            })),
          },
        },
        include: {
          items: {
            include: {
              item: { select: { name: true } },
              chest: { select: { name: true } },
            },
          },
        },
      });
    });

    return ok(mapSaleRow(sale));
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Erreur lors de la création de la vente', 400);
  }
}

export async function cancelSale(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  userId: string;
  canViewAll?: boolean;
}): Promise<DomainResult<{ success: true }>> {
  const sale = await prisma.sale.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    include: { items: true },
  });
  if (!sale) return err('Vente introuvable', 404);
  if (sale.status === 'CANCELLED') return err('Cette vente est déjà annulée', 400);
  if (sale.depositedInCashRegister) {
    return err('Cette vente est déjà déposée en caisse et ne peut plus être annulée', 400);
  }
  if (sale.userId !== input.userId && !input.canViewAll) {
    return err('Vous ne pouvez annuler que vos propres ventes', 403);
  }

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  await prisma.$transaction(async (tx) => {
    await ensureTodayStockForAllActiveChests(tx, input.scopeType, input.scopeId, {
      today,
      tomorrow,
    });

    const chestLines = sale.items.filter((item) => item.source === 'CHEST' && item.chestId);
    if (chestLines.length > 0) {
      const ensured = await ensureTodayStockForPairs(
        tx,
        input.scopeType,
        input.scopeId,
        chestLines.map((item) => ({ itemId: item.itemId, chestId: item.chestId! })),
        { today, tomorrow },
      );

      for (const line of chestLines) {
        const key = `${line.itemId}:${line.chestId}`;
        const stock = ensured.get(key);
        if (stock) {
          await tx.stockHistory.update({
            where: { id: stock.id },
            data: { quantity: stock.quantity + line.quantity },
          });
        } else {
          await tx.stockHistory.create({
            data: {
              itemId: line.itemId,
              chestId: line.chestId!,
              quantity: line.quantity,
            },
          });
        }
      }

      await tx.stockItemMovement.createMany({
        data: chestLines.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          kind: 'SALE_CANCEL_RESTORE',
          chestId: line.chestId,
          userId: input.userId,
        })),
      });
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledByUserId: input.userId,
      },
    });
  });

  return ok({ success: true });
}

export async function depositSale(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  userId: string;
  canDepositOthers?: boolean;
}): Promise<DomainResult<{ success: true }>> {
  const sale = await prisma.sale.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    select: {
      id: true,
      userId: true,
      status: true,
      depositedInCashRegister: true,
    },
  });
  if (!sale) return err('Vente introuvable', 404);
  if (sale.status === 'CANCELLED') return err('Cette vente est annulée', 400);
  if (sale.depositedInCashRegister) return err('Cette vente est déjà déposée en caisse', 400);
  if (sale.userId !== input.userId && !input.canDepositOthers) {
    return err('Vous ne pouvez déposer en caisse que vos propres ventes', 403);
  }

  await prisma.sale.update({
    where: { id: sale.id },
    data: {
      depositedInCashRegister: true,
      depositedInCashRegisterAt: new Date(),
      depositedByUserId: input.userId,
    },
  });

  return ok({ success: true });
}

export async function deleteSale(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  userId: string;
  isAdmin?: boolean;
}): Promise<DomainResult<{ success: true }>> {
  if (!input.isAdmin) {
    return err('Seuls les administrateurs peuvent supprimer une vente', 403);
  }

  const sale = await prisma.sale.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    include: { items: true },
  });
  if (!sale) return err('Vente introuvable', 404);

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  await prisma.$transaction(async (tx) => {
    if (sale.status === 'COMPLETED') {
      await ensureTodayStockForAllActiveChests(tx, input.scopeType, input.scopeId, {
        today,
        tomorrow,
      });
      const chestLines = sale.items.filter((item) => item.source === 'CHEST' && item.chestId);
      if (chestLines.length > 0) {
        const ensured = await ensureTodayStockForPairs(
          tx,
          input.scopeType,
          input.scopeId,
          chestLines.map((item) => ({ itemId: item.itemId, chestId: item.chestId! })),
          { today, tomorrow },
        );
        for (const line of chestLines) {
          const key = `${line.itemId}:${line.chestId}`;
          const stock = ensured.get(key);
          if (stock) {
            await tx.stockHistory.update({
              where: { id: stock.id },
              data: { quantity: stock.quantity + line.quantity },
            });
          } else {
            await tx.stockHistory.create({
              data: {
                itemId: line.itemId,
                chestId: line.chestId!,
                quantity: line.quantity,
              },
            });
          }
        }
        await tx.stockItemMovement.createMany({
          data: chestLines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            kind: 'SALE_CANCEL_RESTORE',
            chestId: line.chestId,
            userId: input.userId,
          })),
        });
      }
    }
    await tx.sale.delete({ where: { id: sale.id } });
  });

  return ok({ success: true });
}

export async function listWeeklySales(input: {
  scopeType: string;
  scopeId: string;
  weekDate?: Date;
  userId: string;
  canViewAll?: boolean;
}): Promise<DomainResult<unknown>> {
  const bounds = getWeekBounds(input.weekDate ?? new Date());
  const sales = await prisma.sale.findMany({
    where: {
      ...scopeWhere(input.scopeType, input.scopeId),
      createdAt: { gte: bounds.start, lte: bounds.end },
      ...(input.canViewAll ? {} : { userId: input.userId }),
    },
    include: {
      items: {
        include: {
          item: { select: { name: true } },
          chest: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const mapped = sales.map(mapSaleRow);
  const completed = mapped.filter((sale) => sale.status === 'COMPLETED');
  const cancelled = mapped.filter((sale) => sale.status === 'CANCELLED');

  const byUserMap = new Map<
    string,
    {
      userId: string;
      totalAmount: number;
      totalQuantity: number;
      completedCount: number;
    }
  >();
  for (const sale of completed) {
    const existing = byUserMap.get(sale.userId) ?? {
      userId: sale.userId,
      totalAmount: 0,
      totalQuantity: 0,
      completedCount: 0,
    };
    existing.totalAmount += sale.totalAmount;
    existing.totalQuantity += sale.totalQuantity;
    existing.completedCount += 1;
    byUserMap.set(sale.userId, existing);
  }

  return ok({
    periodStart: bounds.start.toISOString(),
    periodEnd: bounds.end.toISOString(),
    totalAmount: completed.reduce((sum, sale) => sum + sale.totalAmount, 0),
    totalQuantity: completed.reduce((sum, sale) => sum + sale.totalQuantity, 0),
    completedCount: completed.length,
    cancelledCount: cancelled.length,
    sales: mapped,
    byUser: Array.from(byUserMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
  });
}

export async function getSellableItems(scopeType: string, scopeId: string) {
  const items = await prisma.item.findMany({
    where: {
      isEnabled: true,
      canBeSold: true,
      ...scopeWhere(scopeType, scopeId),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      price: true,
      category: { select: { id: true, name: true, color: true } },
    },
  });
  return ok(
    items.map((item) => ({
      ...item,
      price: decimalToNumber(item.price),
    })),
  );
}
