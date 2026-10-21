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
import { stockTransaction } from '@/lib/stock/lock';
import type { OrderEventChange } from '@lawless-intranet/types';
import type { OrderStatus, OrderType, Prisma } from '@/generated/prisma/client';
import { diffOrderSnapshots, resolvePriceMode, type OrderSnapshot } from '@/lib/domain/orderChanges';

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

type OrderLineInput = { itemId: string; quantity: number };

/** Name and catalog price of the order's items, in this scope. */
async function loadItemCatalog(scopeType: string, scopeId: string, itemIds: string[]) {
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds }, ...scopeWhere(scopeType, scopeId) },
    select: { id: true, name: true, price: true },
  });
  return new Map(items.map((item) => [item.id, item]));
}

function catalogTotal(
  lines: OrderLineInput[],
  catalog: Map<string, { price: unknown }>,
): number | null {
  return calculateOrderPriceFromItems(
    lines.map((line) => ({ quantity: line.quantity, price: catalog.get(line.itemId)?.price ?? null })),
  );
}

const ORDER_SNAPSHOT_SELECT = {
  name: true,
  status: true,
  type: true,
  details: true,
  price: true,
  priceManual: true,
  responsibleUserId: true,
  items: { select: { itemId: true, quantity: true, item: { select: { name: true } } } },
} as const;

type OrderSnapshotRow = {
  name: string;
  status: OrderStatus;
  type: OrderType;
  details: string | null;
  price: unknown;
  priceManual: boolean;
  responsibleUserId: string | null;
  items: { itemId: string; quantity: number; item?: { name: string } | null }[];
};

function toSnapshot(order: OrderSnapshotRow): OrderSnapshot {
  return {
    name: order.name,
    status: order.status,
    type: order.type,
    details: order.details,
    price: order.price != null ? Number(order.price) : null,
    priceManual: order.priceManual,
    responsibleUserId: order.responsibleUserId,
    items: order.items.map((line) => ({
      itemId: line.itemId,
      name: line.item?.name ?? '—',
      quantity: line.quantity,
    })),
  };
}

function changesJson(changes: OrderEventChange[]): Prisma.InputJsonValue {
  return changes as unknown as Prisma.InputJsonValue;
}

export async function createOrder(input: {
  scopeType: string;
  scopeId: string;
  name?: string;
  status?: OrderStatus;
  type?: OrderType;
  details?: string | null;
  price?: number | null;
  /** Defaults to true when a price is sent (older callers), false otherwise. */
  priceManual?: boolean;
  responsibleUserId?: string | null;
  companyId?: string | null;
  individualCustomerId?: string | null;
  companyGroupId?: string | null;
  items: OrderLineInput[];
  actorUserId?: string | null;
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

  const catalog = await loadItemCatalog(
    input.scopeType,
    input.scopeId,
    input.items.map((line) => line.itemId),
  );
  const pricing = resolvePriceMode({
    requestedManual: input.priceManual ?? input.price != null,
    requestedPrice: input.price,
    currentManual: false,
    currentPrice: null,
    catalogTotal: catalogTotal(input.items, catalog),
  });

  const order = await prisma.order.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: orderName,
      status: input.status ?? 'DRAFT',
      type: input.type ?? 'INCOMING',
      details: input.details ?? undefined,
      price: pricing.price,
      priceManual: pricing.priceManual,
      createdByUserId: input.actorUserId ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
      companyId: input.companyId ?? null,
      individualCustomerId: input.individualCustomerId ?? null,
      companyGroupId: input.companyGroupId ?? null,
      items: {
        create: input.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
        })),
      },
      events: { create: { kind: 'CREATED', actorUserId: input.actorUserId ?? null } },
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
  responsibleUserId?: string | null;
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
    ...(input.responsibleUserId ? { responsibleUserId: input.responsibleUserId } : {}),
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
  priceManual?: boolean;
  responsibleUserId?: string | null;
  items?: OrderLineInput[];
  actorUserId?: string | null;
}): Promise<DomainResult<unknown>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const oldOrder = await prisma.order.findFirst({
    where: { id: input.id, ...where },
    select: ORDER_SNAPSHOT_SELECT,
  });
  if (!oldOrder) return err('Commande non trouvée', 404);
  if (oldOrder.status === 'COMPLETED') {
    return err('Les commandes terminées ne peuvent pas être modifiées', 403);
  }

  const before = toSnapshot(oldOrder);
  const itemsToUse =
    input.items || oldOrder.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity }));
  const catalog = await loadItemCatalog(
    input.scopeType,
    input.scopeId,
    itemsToUse.map((line) => line.itemId),
  );
  // An automatic price is recomputed on every save, so it also follows catalog changes.
  const pricing = resolvePriceMode({
    requestedManual: input.priceManual,
    requestedPrice: input.price,
    currentManual: before.priceManual,
    currentPrice: before.price,
    catalogTotal: catalogTotal(itemsToUse, catalog),
  });

  const order = await prisma.$transaction(async (tx) => {
    if (input.items) {
      await tx.orderItem.deleteMany({ where: { orderId: input.id } });
    }
    const updated = await tx.order.update({
      where: { id: input.id },
      data: {
        name: input.name,
        status: input.status,
        type: input.type,
        details: input.details,
        responsibleUserId: input.responsibleUserId,
        price: pricing.price,
        priceManual: pricing.priceManual,
        ...(input.items
          ? {
              items: {
                create: itemsToUse.map((item) => ({
                  itemId: item.itemId,
                  quantity: item.quantity,
                })),
              },
            }
          : {}),
      },
      include: ORDER_DETAIL_INCLUDE,
    });
    const changes = diffOrderSnapshots(before, toSnapshot(updated));
    if (changes.length > 0) {
      await tx.orderEvent.create({
        data: {
          orderId: input.id,
          kind: 'UPDATED',
          actorUserId: input.actorUserId ?? null,
          changes: changesJson(changes),
        },
      });
    }
    return updated;
  });

  return ok(serializeOrder(order));
}

/**
 * Completes an order and mutates stock. Does not send mail.
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
  priceManual?: boolean;
  items?: OrderLineInput[];
  skipStock: boolean;
  stockLines?: { itemId: string; quantity: number; chestId: string }[];
  userId?: string | null;
  effectiveRole?: string | null;
}): Promise<DomainResult<unknown>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const oldOrder = await prisma.order.findFirst({
    where: { id: input.id, ...where },
    select: ORDER_SNAPSHOT_SELECT,
  });
  if (!oldOrder) return err('Commande non trouvée', 404);
  if (oldOrder.status === 'COMPLETED') {
    return err('Les commandes terminées ne peuvent pas être modifiées', 403);
  }
  const before = toSnapshot(oldOrder);

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

  const catalog = await loadItemCatalog(
    input.scopeType,
    input.scopeId,
    itemsToUse.map((line) => line.itemId),
  );
  const pricing = resolvePriceMode({
    requestedManual: input.priceManual,
    requestedPrice: input.price,
    currentManual: before.priceManual,
    currentPrice: before.price,
    catalogTotal: catalogTotal(itemsToUse, catalog),
  });
  const updateData: Record<string, unknown> = {
    name: input.name,
    type: input.type,
    details: input.details,
    status: 'COMPLETED' as OrderStatus,
    price: pricing.price,
    priceManual: pricing.priceManual,
  };

  const today = getTodayStart();
  const tomorrow = getTomorrowStart();

  try {
    const order = await stockTransaction(input.scopeType, input.scopeId, async (tx) => {
      // Checked again under the lock: two validations at once must not both move stock.
      const current = await tx.order.findUnique({ where: { id: input.id }, select: { status: true } });
      if (current?.status === 'COMPLETED') {
        throw new Error('Cette commande est déjà terminée');
      }

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
                data: { quantity: { increment: line.quantity } },
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
              data: { quantity: { decrement: line.quantity } },
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

      await tx.orderEvent.create({
        data: {
          orderId: input.id,
          kind: 'COMPLETED',
          actorUserId: input.userId ?? null,
          changes: changesJson([
            ...diffOrderSnapshots(before, toSnapshot(updated)),
            { field: 'stock', moved: stockLines.length > 0 },
          ]),
        },
      });

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

// --- Chatter ---

function serializeOrderEvent(event: {
  id: string;
  orderId: string;
  kind: string;
  actorUserId: string | null;
  body: string | null;
  changes: unknown;
  createdAt: Date;
  editedAt: Date | null;
}) {
  return {
    ...event,
    changes: (event.changes as OrderEventChange[] | null) ?? null,
    createdAt: event.createdAt.toISOString(),
    editedAt: event.editedAt?.toISOString() ?? null,
  };
}

async function findScopedOrder(scopeType: string, scopeId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, ...scopeWhere(scopeType, scopeId) },
    select: { id: true },
  });
}

/** Chatter of an order, newest first. */
export async function listOrderEvents(input: {
  scopeType: string;
  scopeId: string;
  orderId: string;
}): Promise<DomainResult<unknown>> {
  if (!(await findScopedOrder(input.scopeType, input.scopeId, input.orderId))) {
    return err('Commande non trouvée', 404);
  }
  const events = await prisma.orderEvent.findMany({
    where: { orderId: input.orderId },
    orderBy: { createdAt: 'desc' },
  });
  return ok(events.map(serializeOrderEvent));
}

export async function addOrderComment(input: {
  scopeType: string;
  scopeId: string;
  orderId: string;
  body: string;
  actorUserId: string;
}): Promise<DomainResult<unknown>> {
  if (!(await findScopedOrder(input.scopeType, input.scopeId, input.orderId))) {
    return err('Commande non trouvée', 404);
  }
  const event = await prisma.orderEvent.create({
    data: {
      orderId: input.orderId,
      kind: 'COMMENT',
      body: input.body,
      actorUserId: input.actorUserId,
    },
  });
  return ok(serializeOrderEvent(event), 201);
}

async function findScopedComment(input: {
  scopeType: string;
  scopeId: string;
  orderId: string;
  eventId: string;
}) {
  return prisma.orderEvent.findFirst({
    where: {
      id: input.eventId,
      orderId: input.orderId,
      kind: 'COMMENT',
      order: scopeWhere(input.scopeType, input.scopeId),
    },
    select: { id: true, actorUserId: true },
  });
}

/** Only the author edits a comment. */
export async function updateOrderComment(input: {
  scopeType: string;
  scopeId: string;
  orderId: string;
  eventId: string;
  body: string;
  actorUserId: string;
}): Promise<DomainResult<unknown>> {
  const comment = await findScopedComment(input);
  if (!comment) return err('Commentaire introuvable', 404);
  if (comment.actorUserId !== input.actorUserId) {
    return err('Seul l’auteur peut modifier ce commentaire', 403);
  }
  const event = await prisma.orderEvent.update({
    where: { id: comment.id },
    data: { body: input.body, editedAt: new Date() },
  });
  return ok(serializeOrderEvent(event));
}

/** The author deletes their comment; `canDeleteAny` (checked by the host) deletes anyone's. */
export async function deleteOrderComment(input: {
  scopeType: string;
  scopeId: string;
  orderId: string;
  eventId: string;
  actorUserId: string;
  canDeleteAny: boolean;
}): Promise<DomainResult<{ success: true }>> {
  const comment = await findScopedComment(input);
  if (!comment) return err('Commentaire introuvable', 404);
  if (!input.canDeleteAny && comment.actorUserId !== input.actorUserId) {
    return err('Seul l’auteur peut supprimer ce commentaire', 403);
  }
  await prisma.orderEvent.delete({ where: { id: comment.id } });
  return ok({ success: true });
}

/**
 * New draft with the same customer, group, items and details, priced automatically.
 * Both orders get a DUPLICATED entry pointing to each other.
 */
export async function duplicateOrder(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  actorUserId?: string | null;
}): Promise<DomainResult<unknown>> {
  const source = await prisma.order.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    select: {
      id: true,
      name: true,
      type: true,
      details: true,
      responsibleUserId: true,
      companyId: true,
      individualCustomerId: true,
      companyGroupId: true,
      items: { select: { itemId: true, quantity: true } },
    },
  });
  if (!source) return err('Commande non trouvée', 404);
  if (!source.companyId && !source.individualCustomerId) {
    return err("Le client de cette commande n'existe plus", 400);
  }
  if (source.items.length === 0) return err('Cette commande ne contient aucun article', 400);

  const created = await createOrder({
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    status: 'DRAFT',
    type: source.type,
    details: source.details,
    priceManual: false,
    responsibleUserId: source.responsibleUserId,
    companyId: source.companyId,
    individualCustomerId: source.individualCustomerId,
    companyGroupId: source.companyGroupId,
    items: source.items,
    actorUserId: input.actorUserId,
  });
  if (!created.ok) return created;
  const copy = created.data as { id: string; name: string };

  await prisma.orderEvent.createMany({
    data: [
      {
        orderId: copy.id,
        kind: 'DUPLICATED',
        actorUserId: input.actorUserId ?? null,
        changes: changesJson([
          { field: 'duplicate', direction: 'from', orderId: source.id, orderName: source.name },
        ]),
      },
      {
        orderId: source.id,
        kind: 'DUPLICATED',
        actorUserId: input.actorUserId ?? null,
        changes: changesJson([
          { field: 'duplicate', direction: 'to', orderId: copy.id, orderName: copy.name },
        ]),
      },
    ],
  });

  return created;
}
