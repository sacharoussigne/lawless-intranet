import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';
import { serializeOrder } from '@/lib/serialize';
import { calculateOrderPriceFromItems, slugifyOrderText } from '@/lib/pricing';
import { getTodayStart, getTomorrowStart, getStartOfDay, getDayAfter, parsePickerDate } from '@/lib/date';
import {
  ensureTodayStockForAllActiveChests,
  ensureTodayStockForPairs,
} from '@/lib/stock/ensureTodayStock';
import { resolveChestAccess, hasChestAccess } from '@/lib/chests/access';
import type { OrderStatus, OrderType } from '@/generated/prisma/client';

const ORDER_DETAIL_INCLUDE = {
  company: { select: { id: true, name: true, bankAccountNumber: true } },
  individualCustomer: { select: { id: true, name: true } },
  items: {
    include: {
      item: {
        select: { id: true, name: true, price: true, weight: true, isEnabled: true },
      },
    },
  },
} as const;

const ORDER_LIST_INCLUDE = {
  company: { select: { id: true, name: true } },
  individualCustomer: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} as const;

async function resolveOrderPrice(
  scopeType: string,
  scopeId: string,
  items: { itemId: string; quantity: number }[],
  clientPrice: number | null | undefined,
): Promise<number | null> {
  if (clientPrice !== undefined) return clientPrice;
  const itemsWithPrices = await prisma.item.findMany({
    where: { id: { in: items.map((i) => i.itemId) }, ...scopeWhere(scopeType, scopeId) },
    select: { id: true, price: true },
  });
  return calculateOrderPriceFromItems(
    items.map((orderItem) => {
      const item = itemsWithPrices.find((i) => i.id === orderItem.itemId);
      return { quantity: orderItem.quantity, price: item?.price ?? null };
    }),
  );
}

export async function createOrder(input: {
  scopeType: string;
  scopeId: string;
  name?: string;
  status?: OrderStatus;
  type?: OrderType;
  details?: string | null;
  price?: number | null;
  companyId?: string | null;
  individualCustomerId?: string | null;
  companyGroupId?: string | null;
  items: { itemId: string; quantity: number }[];
}): Promise<DomainResult<unknown>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  let orderName = input.name;

  if (!orderName && input.companyId) {
    const company = await prisma.company.findFirst({
      where: { id: input.companyId, ...where },
      select: { name: true },
    });
    if (!company) return err('Entreprise introuvable', 404);
    const orderCount = await prisma.order.count({
      where: { companyId: input.companyId, ...where },
    });
    orderName = `${slugifyOrderText(company.name)}-${String(orderCount + 1).padStart(4, '0')}`;
  } else if (!orderName && input.individualCustomerId) {
    const customer = await prisma.individualCustomer.findFirst({
      where: { id: input.individualCustomerId, ...where },
      select: { name: true },
    });
    if (!customer) return err('Particulier introuvable', 404);
    const orderCount = await prisma.order.count({
      where: { individualCustomerId: input.individualCustomerId, ...where },
    });
    orderName = `${slugifyOrderText(customer.name)}-${String(orderCount + 1).padStart(4, '0')}`;
  }

  if (!orderName) return err('Le nom de la commande est requis', 400);

  const orderPrice = await resolveOrderPrice(
    input.scopeType,
    input.scopeId,
    input.items,
    input.price,
  );

  const order = await prisma.order.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: orderName,
      status: input.status ?? 'DRAFT',
      type: input.type ?? 'INCOMING',
      details: input.details ?? undefined,
      ...(orderPrice !== null && { price: orderPrice }),
      companyId: input.companyId ?? null,
      individualCustomerId: input.individualCustomerId ?? null,
      companyGroupId: input.companyGroupId ?? null,
      items: {
        create: input.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
        })),
      },
    },
    include: {
      items: { include: { item: { select: { id: true, name: true } } } },
      company: { select: { id: true, name: true } },
      individualCustomer: { select: { id: true, name: true } },
    },
  });

  return ok(serializeOrder(order), 201);
}

export async function listOrdersPage(input: {
  scopeType: string;
  scopeId: string;
  page?: number;
  pageSize?: number;
  status?: OrderStatus[] | null;
  type?: OrderType | null;
  search?: string;
  createdAtFrom?: string | null;
  createdAtTo?: string | null;
}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const searchTerm = input.search?.trim();
  const statuses = input.status?.filter(Boolean) ?? [];
  const fromDate = input.createdAtFrom ? parsePickerDate(input.createdAtFrom) : null;
  const toDate = input.createdAtTo ? parsePickerDate(input.createdAtTo) : null;
  const createdAtFilter =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: getStartOfDay(fromDate) } : {}),
          ...(toDate ? { lt: getDayAfter(toDate) } : {}),
        }
      : undefined;

  const where = {
    ...scopeWhere(input.scopeType, input.scopeId),
    ...(statuses.length === 1
      ? { status: statuses[0] }
      : statuses.length > 1
        ? { status: { in: statuses } }
        : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    ...(searchTerm
      ? { name: { contains: searchTerm, mode: 'insensitive' as const } }
      : {}),
  };

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: ORDER_LIST_INCLUDE,
    }),
    prisma.order.count({ where }),
  ]);

  return ok({
    orders: orders.map((order) => {
      const { _count, price, ...rest } = order;
      return {
        ...rest,
        price: price != null ? Number(price) : null,
        itemCount: _count.items,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      };
    }),
    totalCount,
    page,
    pageSize,
  });
}

export async function getOrderById(input: {
  scopeType: string;
  scopeId: string;
  id: string;
}): Promise<DomainResult<unknown>> {
  const order = await prisma.order.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    include: ORDER_DETAIL_INCLUDE,
  });
  if (!order) return err('Commande non trouvée', 404);
  return ok(serializeOrder(order));
}

export async function getActiveOrdersForCompanyGroup(input: {
  scopeType: string;
  scopeId: string;
  companyGroupId: string;
}): Promise<DomainResult<unknown>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const group = await prisma.companyGroup.findFirst({
    where: { id: input.companyGroupId, ...where },
    select: { companies: { select: { companyId: true } } },
  });
  if (!group) return err("Groupe d'entreprises introuvable", 404);

  const companyIds = group.companies.map((e) => e.companyId);
  const orders = await prisma.order.findMany({
    where: {
      ...where,
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      OR: [
        { companyGroupId: input.companyGroupId },
        ...(companyIds.length > 0 ? [{ companyId: { in: companyIds } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      companyGroupId: true,
      company: { select: { id: true, name: true } },
      individualCustomer: { select: { id: true, name: true } },
      items: {
        select: {
          itemId: true,
          quantity: true,
          item: { select: { id: true, name: true } },
        },
      },
    },
  });
  return ok(orders);
}

export async function updateOrder(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  name?: string;
  status?: Exclude<OrderStatus, 'COMPLETED'>;
  type?: OrderType;
  details?: string | null;
  price?: number | null;
  items?: { itemId: string; quantity: number }[];
}): Promise<DomainResult<unknown>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const oldOrder = await prisma.order.findFirst({
    where: { id: input.id, ...where },
    select: {
      status: true,
      type: true,
      items: { select: { itemId: true, quantity: true } },
    },
  });
  if (!oldOrder) return err('Commande non trouvée', 404);
  if (oldOrder.status === 'COMPLETED') {
    return err('Les commandes terminées ne peuvent pas être modifiées', 403);
  }

  const itemsToUse =
    input.items || oldOrder.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity }));

  const updateData: Record<string, unknown> = {
    name: input.name,
    status: input.status,
    type: input.type,
    details: input.details,
  };

  if (input.price !== undefined || input.items) {
    updateData.price = await resolveOrderPrice(
      input.scopeType,
      input.scopeId,
      itemsToUse,
      input.price,
    );
  }

  const order = await prisma.$transaction(async (tx) => {
    if (input.items) {
      await tx.orderItem.deleteMany({ where: { orderId: input.id } });
      updateData.items = {
        create: itemsToUse.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
        })),
      };
    }
    return tx.order.update({
      where: { id: input.id },
      data: updateData,
      include: ORDER_DETAIL_INCLUDE,
    });
  });

  return ok(serializeOrder(order));
}

/**
 * Completes an order and mutates stock. Does NOT create bank transactions or send mail.
 * Returns order data so the host can orchestrate side effects.
 */
export async function completeOrder(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  name?: string;
  type?: OrderType;
  details?: string | null;
  price?: number | null;
  items?: { itemId: string; quantity: number }[];
  skipStock: boolean;
  stockLines?: { itemId: string; quantity: number; chestId: string }[];
  userId?: string | null;
  effectiveRole?: string | null;
}): Promise<DomainResult<unknown>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const oldOrder = await prisma.order.findFirst({
    where: { id: input.id, ...where },
    select: {
      status: true,
      type: true,
      price: true,
      name: true,
      company: { select: { name: true, bankAccountNumber: true } },
      individualCustomer: { select: { name: true } },
      items: {
        select: {
          itemId: true,
          quantity: true,
          item: { select: { id: true, isEnabled: true } },
        },
      },
    },
  });
  if (!oldOrder) return err('Commande non trouvée', 404);
  if (oldOrder.status === 'COMPLETED') {
    return err('Les commandes terminées ne peuvent pas être modifiées', 403);
  }

  const itemsToUse =
    input.items ||
    oldOrder.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity }));
  const orderType = input.type ?? oldOrder.type;
  const isIncoming = orderType === 'INCOMING';
  const stockLines = input.skipStock ? [] : (input.stockLines ?? []);

  if (stockLines.length > 0) {
    const orderQtyByItemId = new Map(itemsToUse.map((item) => [item.itemId, item.quantity]));
    const enabledItems = await prisma.item.findMany({
      where: {
        id: { in: itemsToUse.map((item) => item.itemId) },
        isEnabled: true,
        ...where,
      },
      select: { id: true },
    });
    const enabledItemIds = new Set(enabledItems.map((item) => item.id));
    const seenItemIds = new Set<string>();

    for (const line of stockLines) {
      if (seenItemIds.has(line.itemId)) {
        return err("Chaque article ne peut apparaître qu'une fois", 400);
      }
      seenItemIds.add(line.itemId);
      const expectedQty = orderQtyByItemId.get(line.itemId);
      if (expectedQty == null) return err("Un article n'appartient pas à la commande", 400);
      if (line.quantity !== expectedQty) {
        return err('La quantité stock ne correspond pas à la commande', 400);
      }
      if (!enabledItemIds.has(line.itemId)) {
        return err('Un ou plusieurs articles sont désactivés', 400);
      }
    }

    const chestIds = Array.from(new Set(stockLines.map((line) => line.chestId)));
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

  const updateData: Record<string, unknown> = {
    name: input.name,
    type: input.type,
    details: input.details,
    status: 'COMPLETED' as OrderStatus,
  };

  if (input.price !== undefined || input.items) {
    updateData.price = await resolveOrderPrice(
      input.scopeType,
      input.scopeId,
      itemsToUse,
      input.price,
    );
  }

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  try {
    const order = await prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.orderItem.deleteMany({ where: { orderId: input.id } });
        updateData.items = {
          create: itemsToUse.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        };
      }

      const updated = await tx.order.update({
        where: { id: input.id },
        data: updateData,
        include: ORDER_DETAIL_INCLUDE,
      });

      if (stockLines.length > 0) {
        await ensureTodayStockForAllActiveChests(tx, input.scopeType, input.scopeId, {
          today,
          tomorrow,
        });
        const ensured = await ensureTodayStockForPairs(
          tx,
          input.scopeType,
          input.scopeId,
          stockLines.map((line) => ({ itemId: line.itemId, chestId: line.chestId })),
          { today, tomorrow },
        );

        for (const line of stockLines) {
          const key = `${line.itemId}:${line.chestId}`;
          const stock = ensured.get(key);

          if (isIncoming) {
            if (stock) {
              await tx.stockHistory.update({
                where: { id: stock.id },
                data: { quantity: stock.quantity + line.quantity },
              });
              stock.quantity += line.quantity;
            } else {
              const created = await tx.stockHistory.create({
                data: {
                  itemId: line.itemId,
                  chestId: line.chestId,
                  quantity: line.quantity,
                },
              });
              ensured.set(key, {
                id: created.id,
                itemId: line.itemId,
                chestId: line.chestId,
                quantity: line.quantity,
              });
            }
          } else {
            if (!stock) {
              throw new Error(`Aucun stock trouvé pour l'objet dans le coffre sélectionné`);
            }
            if (stock.quantity < line.quantity) {
              throw new Error(
                `Stock insuffisant (disponible: ${stock.quantity}, demandé: ${line.quantity})`,
              );
            }
            await tx.stockHistory.update({
              where: { id: stock.id },
              data: { quantity: stock.quantity - line.quantity },
            });
            stock.quantity -= line.quantity;
          }
        }

        await tx.stockItemMovement.createMany({
          data: stockLines.map((line) => ({
            itemId: line.itemId,
            quantity: isIncoming ? line.quantity : -line.quantity,
            kind: isIncoming ? 'ORDER_IN' : 'ORDER_OUT',
            chestId: line.chestId,
            userId: input.userId ?? null,
          })),
        });
      }

      return updated;
    });

    return ok(serializeOrder(order));
  } catch (error) {
    return err(
      error instanceof Error ? error.message : 'Erreur lors de la finalisation de la commande',
      400,
    );
  }
}

export async function deleteOrder(input: {
  scopeType: string;
  scopeId: string;
  id: string;
}): Promise<DomainResult<{ success: true }>> {
  const order = await prisma.order.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    select: { status: true },
  });
  if (!order) return err('Commande non trouvée', 404);
  if (order.status === 'COMPLETED') {
    return err('Les commandes terminées ne peuvent pas être supprimées', 403);
  }
  await prisma.order.delete({ where: { id: input.id } });
  return ok({ success: true });
}
