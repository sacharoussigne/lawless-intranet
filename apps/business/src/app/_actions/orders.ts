'use server';

import { loggedAction } from '@/lib/logs/writer';
import { parseRealtimeMutationMeta } from '@lawless-intranet/realtime';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import {
  completeOrder as completeOrderApi,
  createOrder as createOrderApi,
  deleteOrder as deleteOrderApi,
  getActiveOrdersForCompanyGroup as getActiveOrdersForCompanyGroupApi,
  getOrderById as getOrderByIdApi,
  listOrdersPage,
  updateOrder as updateOrderApi,
} from '@lawless-intranet/inventory-client/server';
import {
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { emitOrdersChange } from '@/lib/orders/realtime/broadcast';
import { emitStockChange } from '@/lib/stock/realtime/broadcast';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import prisma from '@/lib/prisma';
import { fetchBusinessUserProfiles } from '@/lib/people/userProfiles';
import type {
  ActiveOrderSummary,
  OrderSummary,
  OrdersPageResult,
  OrderWithRelations,
} from '@/types/orders';

const createOrderSchema = z
  .object({
    name: z.string().max(255, 'Le nom est trop long').optional(),
    status: z
      .enum(['DRAFT', 'LETTER_SENT', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'])
      .default('DRAFT'),
    type: z.enum(['INCOMING', 'OUTGOING']).default('INCOMING'),
    details: z.string().max(1000, 'Les détails sont trop longs').optional(),
    price: z
      .number()
      .positive('Le prix doit être positif')
      .optional()
      .nullable(),
    priceManual: z.boolean().optional(),
    responsibleUserId: z.string().min(1).optional().nullable(),
    companyId: z.string().uuid("ID d'entreprise invalide").optional(),
    individualCustomerId: z.string().uuid('ID de particulier invalide').optional(),
    companyGroupId: z.string().uuid('ID de groupe invalide').optional().nullable(),
    items: z
      .array(
        z.object({
          itemId: z.string().uuid("ID d'item invalide"),
          quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
        }),
      )
      .min(1, 'Au moins un objet est requis'),
  })
  .refine(
    (d) =>
      (Boolean(d.companyId) && !d.individualCustomerId) ||
      (!d.companyId && Boolean(d.individualCustomerId)),
    { message: 'Indiquez une entreprise ou un particulier', path: ['companyId'] },
  );

async function createOrderUnlogged(
  businessSlug: string,
  data: {
    name?: string;
    status?: 'DRAFT' | 'LETTER_SENT' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELLED';
    type?: 'INCOMING' | 'OUTGOING';
    details?: string;
    price?: number | null;
    priceManual?: boolean;
    responsibleUserId?: string | null;
    companyId?: string;
    individualCustomerId?: string;
    companyGroupId?: string | null;
    items: { itemId: string; quantity: number }[];
  },
  meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'orders',
      permission: {
        resource: 'orders',
        action: 'create',
        message:
          "Permission refusée : vous n'avez pas la permission de créer une commande",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = createOrderSchema.parse(data);
    const responsibleError = await checkResponsible(businessId, validatedData.responsibleUserId);
    if (responsibleError) return responsibleError;

    const order = await createOrderApi(
      {
        ...inventoryScope(businessId),
        name: validatedData.name,
        status: validatedData.status,
        type: validatedData.type,
        details: validatedData.details,
        price: validatedData.price,
        priceManual: validatedData.priceManual,
        responsibleUserId: validatedData.responsibleUserId,
        companyId: validatedData.companyId,
        individualCustomerId: validatedData.individualCustomerId,
        companyGroupId: validatedData.companyGroupId,
        items: validatedData.items,
      },
      await inventoryCookie(),
    );

    emitOrdersChange(businessId, { orderId: order.id }, parseRealtimeMutationMeta(meta));

    return {
      status: 201,
      data: order as unknown as OrderWithRelations,
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la création de la commande');
  }
}

const updateOrderSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long').optional(),
  status: z.enum(['DRAFT', 'LETTER_SENT', 'PROCESSING', 'READY', 'CANCELLED']).optional(),
  type: z.enum(['INCOMING', 'OUTGOING']).optional(),
  details: z.string().max(1000, 'Les détails sont trop longs').optional(),
  price: z
    .number()
    .positive('Le prix doit être positif')
    .optional()
    .nullable(),
  priceManual: z.boolean().optional(),
  responsibleUserId: z.string().min(1).optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid("ID d'item invalide"),
        quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
      }),
    )
    .min(1, 'Au moins un objet est requis')
    .optional(),
});

const completeOrderSchema = z
  .object({
    id: z.string().uuid('ID invalide'),
    name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long').optional(),
    type: z.enum(['INCOMING', 'OUTGOING']).optional(),
    details: z.string().max(1000, 'Les détails sont trop longs').optional(),
    price: z
      .number()
      .positive('Le prix doit être positif')
      .optional()
      .nullable(),
    priceManual: z.boolean().optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().uuid("ID d'item invalide"),
          quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
        }),
      )
      .min(1, 'Au moins un objet est requis')
      .optional(),
    skipStock: z.boolean(),
    stockLines: z
      .array(
        z.object({
          itemId: z.string().uuid("ID d'item invalide"),
          quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
          chestId: z.string().uuid('ID de coffre invalide'),
        }),
      )
      .optional(),
  });

const deleteOrderSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const orderStatusValues = [
  'DRAFT',
  'LETTER_SENT',
  'PROCESSING',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;

const orderTypeValues = ['INCOMING', 'OUTGOING'] as const;

const getOrdersPageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
  status: z.array(z.enum(orderStatusValues)).optional().nullable(),
  type: z.enum(orderTypeValues).optional().nullable(),
  search: z.string().max(255).optional(),
  createdAtFrom: z.string().optional().nullable(),
  createdAtTo: z.string().optional().nullable(),
  /** Only the orders the signed-in user is responsible for. */
  mine: z.boolean().optional(),
});

const getOrderByIdSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const getActiveOrdersForCompanyGroupSchema = z.object({
  companyGroupId: z.string().uuid('ID de groupe invalide'),
});

/** A responsible must be a member of the business (null clears it). */
async function checkResponsible(businessId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const member = await prisma.businessMember.findFirst({
    where: { businessId, userId },
    select: { id: true },
  });
  return member ? null : { status: 422, error: "Le responsable n'est pas membre de l'entreprise" };
}

async function requireOrdersViewContext(businessSlug: string) {
  return requireTenantServerActionContext(businessSlug, {
    feature: 'orders',
    permission: {
      resource: 'orders',
      action: 'view',
      message:
        "Permission refusée : vous n'avez pas la permission de voir les commandes",
    },
  });
}

export async function getOrdersPage(
  businessSlug: string,
  params: {
    page?: number;
    pageSize?: number;
    status?: Array<(typeof orderStatusValues)[number]> | null;
    type?: (typeof orderTypeValues)[number] | null;
    search?: string;
    createdAtFrom?: string | null;
    createdAtTo?: string | null;
    mine?: boolean;
  } = {},
) {
  try {
    const ctx = await requireOrdersViewContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const { page, pageSize, status, type, search, createdAtFrom, createdAtTo, mine } =
      getOrdersPageSchema.parse(params);

    const result = await listOrdersPage(
      {
        ...inventoryScope(businessId),
        page,
        pageSize,
        status: status?.filter(Boolean) ?? undefined,
        type,
        search,
        createdAtFrom,
        createdAtTo,
        responsibleUserId: mine ? ctx.tenant.userId : null,
      },
      await inventoryCookie(),
    );

    const pageResult: OrdersPageResult = {
      orders: result.orders.map((order) => ({
        ...order,
        itemCount: order.itemCount ?? order._count?.items ?? 0,
      })) as unknown as OrderSummary[],
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
    };

    return {
      status: 200,
      data: pageResult,
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des commandes');
  }
}

export async function getOrderById(businessSlug: string, data: { id: string }) {
  try {
    const ctx = await requireOrdersViewContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const { id } = getOrderByIdSchema.parse(data);

    const order = await getOrderByIdApi(
      { ...inventoryScope(businessId), id },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: order as unknown as OrderWithRelations,
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération de la commande');
  }
}

export async function getActiveOrdersForCompanyGroup(
  businessSlug: string,
  data: { companyGroupId: string },
) {
  try {
    const ctx = await requireOrdersViewContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const { companyGroupId } = getActiveOrdersForCompanyGroupSchema.parse(data);

    const orders = await getActiveOrdersForCompanyGroupApi(
      { ...inventoryScope(businessId), companyGroupId },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: orders as unknown as ActiveOrderSummary[],
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des commandes actives');
  }
}

/** Members of the business, to pick an order's responsible. */
export async function listOrderResponsibleOptions(businessSlug: string) {
  try {
    const ctx = await requireOrdersViewContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const members = await prisma.businessMember.findMany({
      where: { businessId },
      select: { userId: true },
    });
    const profiles = await fetchBusinessUserProfiles(
      businessId,
      members.map((member) => member.userId),
    );
    const options = members
      .map((member) => {
        const profile = profiles.get(member.userId);
        return {
          userId: member.userId,
          name: profile?.name ?? member.userId,
          image: profile?.image ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    return { status: 200, data: options };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des membres');
  }
}

async function updateOrderUnlogged(
  businessSlug: string,
  data: {
    id: string;
    name?: string;
    status?: 'DRAFT' | 'LETTER_SENT' | 'PROCESSING' | 'READY' | 'CANCELLED';
    type?: 'INCOMING' | 'OUTGOING';
    details?: string;
    price?: number | null;
    priceManual?: boolean;
    responsibleUserId?: string | null;
    items?: { itemId: string; quantity: number }[];
  },
  meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'orders',
      permission: {
        resource: 'orders',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de modifier une commande",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    if ((data as { status?: string }).status === 'COMPLETED') {
      return {
        status: 400,
        error: 'Utilisez completeOrder pour terminer une commande',
      };
    }

    const validatedData = updateOrderSchema.parse(data);
    const responsibleError = await checkResponsible(businessId, validatedData.responsibleUserId);
    if (responsibleError) return responsibleError;

    const order = await updateOrderApi(
      {
        ...inventoryScope(businessId),
        id: validatedData.id,
        name: validatedData.name,
        status: validatedData.status,
        type: validatedData.type,
        details: validatedData.details,
        price: validatedData.price,
        priceManual: validatedData.priceManual,
        responsibleUserId: validatedData.responsibleUserId,
        items: validatedData.items,
      },
      await inventoryCookie(),
    );

    emitOrdersChange(businessId, { orderId: order.id }, parseRealtimeMutationMeta(meta));

    return {
      status: 200,
      data: order as unknown as OrderWithRelations,
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la modification de la commande');
  }
}

async function completeOrderUnlogged(
  businessSlug: string,
  data: {
    id: string;
    name?: string;
    type?: 'INCOMING' | 'OUTGOING';
    details?: string;
    price?: number | null;
    priceManual?: boolean;
    items?: { itemId: string; quantity: number }[];
    skipStock: boolean;
    stockLines?: { itemId: string; quantity: number; chestId: string }[];
  },
  meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'orders',
      permission: {
        resource: 'orders',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de modifier une commande",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const validatedData = completeOrderSchema.parse(data);

    const order = await completeOrderApi(
      {
        ...inventoryScope(businessId),
        id: validatedData.id,
        skipStock: validatedData.skipStock,
        stockLines: validatedData.stockLines,
        name: validatedData.name,
        type: validatedData.type,
        details: validatedData.details,
        price: validatedData.price,
        priceManual: validatedData.priceManual,
        items: validatedData.items,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    emitOrdersChange(businessId, { orderId: order.id }, parseRealtimeMutationMeta(meta));
    if (!validatedData.skipStock && (validatedData.stockLines?.length ?? 0) > 0) {
      emitStockChange(businessId, parseRealtimeMutationMeta(meta));
    }

    return {
      status: 200,
      data: order as unknown as OrderWithRelations,
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la finalisation de la commande');
  }
}

async function deleteOrderUnlogged(
  businessSlug: string,
  data: { id: string },
  meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'orders',
      permission: {
        resource: 'orders',
        action: 'delete',
        message:
          "Permission refusée : vous n'avez pas la permission de supprimer une commande",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = deleteOrderSchema.parse(data);

    await deleteOrderApi(
      { ...inventoryScope(businessId), id: validatedData.id },
      await inventoryCookie(),
    );

    emitOrdersChange(businessId, { orderId: validatedData.id }, parseRealtimeMutationMeta(meta));

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression de la commande');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createOrder(...args: Parameters<typeof createOrderUnlogged>) {
  return loggedAction({ feature: 'orders', event: 'orders.createOrder' }, args, () =>
    createOrderUnlogged(...args),
  );
}

export async function updateOrder(...args: Parameters<typeof updateOrderUnlogged>) {
  return loggedAction({ feature: 'orders', event: 'orders.updateOrder' }, args, () =>
    updateOrderUnlogged(...args),
  );
}

export async function completeOrder(...args: Parameters<typeof completeOrderUnlogged>) {
  return loggedAction({ feature: 'orders', event: 'orders.completeOrder' }, args, () =>
    completeOrderUnlogged(...args),
  );
}

export async function deleteOrder(...args: Parameters<typeof deleteOrderUnlogged>) {
  return loggedAction({ feature: 'orders', event: 'orders.deleteOrder' }, args, () =>
    deleteOrderUnlogged(...args),
  );
}
