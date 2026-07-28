'use server';

import { SaleItemSource, SaleStatus, StockMovementKind } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { checkRolePermission } from '@lawless-intranet/auth-permissions';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { getTodayStart, getTomorrowStart } from '@/lib/date';
import { getBankWeekBounds } from '@/lib/bankWeek';
import { ensureTodayStockForPairs, ensureTodayStockForAllActiveChests } from '@/lib/stock/ensureTodayStock';
import { getSaleEffectiveTotal } from '@/lib/sales/pricing';
import { fetchUserProfiles } from '@/lib/authUsers';

const saleItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  source: z.nativeEnum(SaleItemSource),
  chestId: z.string().uuid().nullable().optional(),
});

const createSaleSchema = z.object({
  defaultChestId: z.string().uuid().nullable().optional(),
  customerName: z.string().max(255).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  individualCustomerId: z.string().uuid().optional().nullable(),
  priceAdjustment: z.number().finite().default(0),
  items: z.array(saleItemSchema).min(1),
});

export type SaleListItem = {
  id: string;
  userId: string;
  userName: string;
  status: SaleStatus;
  createdAt: Date;
  cancelledAt: Date | null;
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

export type WeeklySalesSummary = {
  periodStart: Date;
  periodEnd: Date;
  totalAmount: number;
  totalQuantity: number;
  completedCount: number;
  cancelledCount: number;
  sales: SaleListItem[];
  byUser: {
    userId: string;
    userName: string;
    totalAmount: number;
    totalQuantity: number;
    completedCount: number;
  }[];
};

function mapSaleRow(
  sale: {
    id: string;
    userId: string;
    status: SaleStatus;
    createdAt: Date;
    cancelledAt: Date | null;
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
  },
  userNameById: Map<string, string>,
): SaleListItem {
  const items = sale.items.map((item) => ({
    id: item.id,
    itemId: item.itemId,
    itemName: item.item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
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
    userName: userNameById.get(sale.userId) ?? 'Utilisateur',
    status: sale.status,
    createdAt: sale.createdAt,
    cancelledAt: sale.cancelledAt,
    customerName: sale.customerName,
    description: sale.description,
    priceAdjustment,
    subtotalAmount,
    totalAmount,
    totalQuantity,
    items,
  };
}

export async function createSale(
  dispensarySlug: string,
  rawData: z.infer<typeof createSaleSchema>,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: {
        resource: 'sales',
        action: 'create',
        message: 'Permission refusée : vous n\'avez pas la permission de créer une vente',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;
    const userId = ctx.session.user.id;

    const data = createSaleSchema.parse(rawData);
    const customerName = data.customerName?.trim() || null;
    const description = data.description?.trim() || null;
    const priceAdjustment = data.priceAdjustment ?? 0;
    let individualCustomerId = data.individualCustomerId ?? null;

    if (individualCustomerId) {
      const linked = await prisma.individualCustomer.findFirst({
        where: { id: individualCustomerId, ...tenantWhere(dispensaryId) },
        select: { id: true, name: true },
      });
      if (!linked) {
        return { status: 400, error: 'Client introuvable' };
      }
      if (customerName && linked.name.trim().toLowerCase() !== customerName.toLowerCase()) {
        individualCustomerId = null;
      }
    }

    if (!individualCustomerId && customerName) {
      const match = await prisma.individualCustomer.findFirst({
        where: {
          ...tenantWhere(dispensaryId),
          name: { equals: customerName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      individualCustomerId = match?.id ?? null;
    }

    const normalizedItems = data.items.map((item) => {
      const source = item.source;
      const chestId =
        source === SaleItemSource.CHEST
          ? item.chestId || data.defaultChestId || null
          : null;
      return { ...item, source, chestId };
    });

    for (const item of normalizedItems) {
      if (item.source === SaleItemSource.CHEST && !item.chestId) {
        return { status: 400, error: 'Un coffre est requis pour les objets provenant d\'un coffre' };
      }
    }

    const itemIds = Array.from(new Set(normalizedItems.map((item) => item.itemId)));
    const items = await prisma.item.findMany({
      where: {
        id: { in: itemIds },
        isEnabled: true,
        canBeSold: true,
        ...tenantWhere(dispensaryId),
      },
      select: { id: true, price: true, name: true },
    });

    if (items.length !== itemIds.length) {
      return { status: 400, error: 'Un ou plusieurs objets ne sont pas vendables' };
    }

    const itemById = new Map(items.map((item) => [item.id, item]));

    const subtotal = normalizedItems.reduce((sum, line) => {
      const catalogPrice = itemById.get(line.itemId)?.price;
      const unitPrice = catalogPrice != null ? Number(catalogPrice) : 0;
      return sum + unitPrice * line.quantity;
    }, 0);
    if (priceAdjustment < -subtotal) {
      return { status: 400, error: 'Le total ne peut pas être négatif' };
    }
    const chestIds = Array.from(
      new Set(
        normalizedItems
          .filter((item) => item.source === SaleItemSource.CHEST && item.chestId)
          .map((item) => item.chestId!),
      ),
    );

    if (chestIds.length > 0) {
      const chests = await prisma.chest.findMany({
        where: {
          id: { in: chestIds },
          isEnabled: true,
          ...tenantWhere(dispensaryId),
        },
        select: { id: true },
      });
      if (chests.length !== chestIds.length) {
        return { status: 400, error: 'Un ou plusieurs coffres sont invalides' };
      }
    }

    const today = getTodayStart();
    const tomorrow = getTomorrowStart();

    const sale = await prisma.$transaction(async (tx) => {
      await ensureTodayStockForAllActiveChests(tx, dispensaryId, { today, tomorrow });

      const chestLines = normalizedItems.filter(
        (item) => item.source === SaleItemSource.CHEST && item.chestId,
      );

      if (chestLines.length > 0) {
        const ensured = await ensureTodayStockForPairs(
          tx,
          dispensaryId,
          chestLines.map((item) => ({ itemId: item.itemId, chestId: item.chestId! })),
          { today, tomorrow },
        );

        for (const line of chestLines) {
          const key = `${line.itemId}:${line.chestId}`;
          const stock = ensured.get(key);
          if (!stock) {
            throw new Error(`Stock introuvable pour ${itemById.get(line.itemId)?.name ?? line.itemId}`);
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
            kind: StockMovementKind.SALE_OUT,
            chestId: line.chestId,
            userId,
          })),
        });
      }

      return tx.sale.create({
        data: {
          dispensaryId,
          userId,
          status: SaleStatus.COMPLETED,
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

    return {
      status: 200,
      data: mapSaleRow(sale, new Map([[userId, ctx.session.user.name ?? 'Utilisateur']])),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la vente');
  }
}

export async function cancelSale(dispensarySlug: string, saleId: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: {
        resource: 'sales',
        action: 'cancel',
        message: 'Permission refusée : vous n\'avez pas la permission d\'annuler une vente',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const userId = ctx.session.user.id;
    const canViewAll = checkRolePermission(effectiveRole, 'sales', 'view_all');

    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        dispensaryId,
      },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return { status: 404, error: 'Vente introuvable' };
    }

    if (sale.status === SaleStatus.CANCELLED) {
      return { status: 400, error: 'Cette vente est déjà annulée' };
    }

    if (sale.userId !== userId && !canViewAll) {
      return { status: 403, error: 'Vous ne pouvez annuler que vos propres ventes' };
    }

    const today = getTodayStart();
    const tomorrow = getTomorrowStart();

    await prisma.$transaction(async (tx) => {
      await ensureTodayStockForAllActiveChests(tx, dispensaryId, { today, tomorrow });

      const chestLines = sale.items.filter(
        (item) => item.source === SaleItemSource.CHEST && item.chestId,
      );

      if (chestLines.length > 0) {
        const ensured = await ensureTodayStockForPairs(
          tx,
          dispensaryId,
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
            kind: StockMovementKind.SALE_CANCEL_RESTORE,
            chestId: line.chestId,
            userId,
          })),
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledByUserId: userId,
        },
      });
    });

    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l\'annulation de la vente');
  }
}

export async function listWeeklySales(
  dispensarySlug: string,
  weekDate?: Date,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: {
        resource: 'sales',
        action: 'view',
        message: 'Permission refusée : vous n\'avez pas la permission de consulter les ventes',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const userId = ctx.session.user.id;
    const canViewAll = checkRolePermission(effectiveRole, 'sales', 'view_all');

    const bounds = getBankWeekBounds(weekDate ?? new Date());

    const sales = await prisma.sale.findMany({
      where: {
        dispensaryId,
        createdAt: {
          gte: bounds.start,
          lte: bounds.end,
        },
        ...(canViewAll ? {} : { userId }),
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

    const userIds = Array.from(new Set(sales.map((sale) => sale.userId)));
    const profiles = await fetchUserProfiles(userIds);
    const userNameById = new Map(
      Array.from(profiles.entries()).map(([id, profile]) => [id, profile.name]),
    );

    const mapped = sales.map((sale) => mapSaleRow(sale, userNameById));
    const completed = mapped.filter((sale) => sale.status === SaleStatus.COMPLETED);
    const cancelled = mapped.filter((sale) => sale.status === SaleStatus.CANCELLED);

    const byUserMap = new Map<string, WeeklySalesSummary['byUser'][number]>();
    for (const sale of completed) {
      const existing = byUserMap.get(sale.userId) ?? {
        userId: sale.userId,
        userName: sale.userName,
        totalAmount: 0,
        totalQuantity: 0,
        completedCount: 0,
      };
      existing.totalAmount += sale.totalAmount;
      existing.totalQuantity += sale.totalQuantity;
      existing.completedCount += 1;
      byUserMap.set(sale.userId, existing);
    }

    const summary: WeeklySalesSummary = {
      periodStart: bounds.start,
      periodEnd: bounds.end,
      totalAmount: completed.reduce((sum, sale) => sum + sale.totalAmount, 0),
      totalQuantity: completed.reduce((sum, sale) => sum + sale.totalQuantity, 0),
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      sales: mapped,
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
    };

    return { status: 200, data: summary };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des ventes');
  }
}

export async function getSellableItems(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: {
        resource: 'sales',
        action: 'create',
        message: 'Permission refusée',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const items = await prisma.item.findMany({
      where: {
        isEnabled: true,
        canBeSold: true,
        ...tenantWhere(dispensaryId),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        category: { select: { id: true, name: true, color: true } },
      },
    });

    return {
      status: 200,
      data: items.map((item) => ({
        ...item,
        price: item.price != null ? Number(item.price) : null,
      })),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des objets vendables');
  }
}
