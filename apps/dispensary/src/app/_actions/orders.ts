'use server';

import { z } from 'zod/v3';
import { parseISO } from 'date-fns';
import {
  completeOrder as completeOrderApi,
  createOrder as createOrderApi,
  deleteOrder as deleteOrderApi,
  getActiveOrdersForCompanyGroup as getActiveOrdersForCompanyGroupApi,
  getOrderById as getOrderByIdApi,
  listOrdersPage,
  updateOrder as updateOrderApi,
} from '@lawless-intranet/inventory-client/server';
import { actionErrorParser } from '@/lib/action';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import { createBankTransactionFromOrder } from '@/lib/bank/fromOrder';
import { bankCookie } from '@/lib/bank/client';
import {
  inventoryActionError,
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
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

export async function createOrder(
  dispensarySlug: string,
  data: {
    name?: string;
    status?: 'DRAFT' | 'LETTER_SENT' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELLED';
    type?: 'INCOMING' | 'OUTGOING';
    details?: string;
    price?: number;
    companyId?: string;
    individualCustomerId?: string;
    companyGroupId?: string | null;
    items: { itemId: string; quantity: number }[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'orders',
      permission: {
        resource: 'orders',
        action: 'create',
        message:
          "Permission refusée : vous n'avez pas la permission de créer une commande",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createOrderSchema.parse(data);

    const order = await createOrderApi(
      {
        ...inventoryScope(dispensaryId),
        name: validatedData.name,
        status: validatedData.status,
        type: validatedData.type,
        details: validatedData.details,
        price: validatedData.price,
        companyId: validatedData.companyId,
        individualCustomerId: validatedData.individualCustomerId,
        companyGroupId: validatedData.companyGroupId,
        items: validatedData.items,
      },
      await inventoryCookie(),
    );

    return {
      status: 201,
      data: order as unknown as OrderWithRelations,
    };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création de la commande');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la commande');
    }
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
    createBankTransaction: z.boolean().optional(),
    bankTransactionDate: z.string().or(z.date()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.createBankTransaction && !data.bankTransactionDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La date de transaction bancaire est requise',
        path: ['bankTransactionDate'],
      });
    }
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
});

const getOrderByIdSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const getActiveOrdersForCompanyGroupSchema = z.object({
  companyGroupId: z.string().uuid('ID de groupe invalide'),
});

async function requireOrdersViewContext(dispensarySlug: string) {
  return requireTenantServerActionContext(dispensarySlug, {
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
  dispensarySlug: string,
  params: {
    page?: number;
    pageSize?: number;
    status?: Array<(typeof orderStatusValues)[number]> | null;
    type?: (typeof orderTypeValues)[number] | null;
    search?: string;
    createdAtFrom?: string | null;
    createdAtTo?: string | null;
  } = {},
) {
  try {
    const ctx = await requireOrdersViewContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { page, pageSize, status, type, search, createdAtFrom, createdAtTo } =
      getOrdersPageSchema.parse(params);

    const result = await listOrdersPage(
      {
        ...inventoryScope(dispensaryId),
        page,
        pageSize,
        status: status?.filter(Boolean) ?? undefined,
        type,
        search,
        createdAtFrom,
        createdAtTo,
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
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des commandes',
      );
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des commandes');
    }
  }
}

export async function getOrderById(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireOrdersViewContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { id } = getOrderByIdSchema.parse(data);

    const order = await getOrderByIdApi(
      { ...inventoryScope(dispensaryId), id },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: order as unknown as OrderWithRelations,
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération de la commande',
      );
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération de la commande');
    }
  }
}

export async function getActiveOrdersForCompanyGroup(
  dispensarySlug: string,
  data: { companyGroupId: string },
) {
  try {
    const ctx = await requireOrdersViewContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { companyGroupId } = getActiveOrdersForCompanyGroupSchema.parse(data);

    const orders = await getActiveOrdersForCompanyGroupApi(
      { ...inventoryScope(dispensaryId), companyGroupId },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: orders as unknown as ActiveOrderSummary[],
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des commandes actives',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des commandes actives',
      );
    }
  }
}

export async function updateOrder(
  dispensarySlug: string,
  data: {
    id: string;
    name?: string;
    status?: 'DRAFT' | 'LETTER_SENT' | 'PROCESSING' | 'READY' | 'CANCELLED';
    type?: 'INCOMING' | 'OUTGOING';
    details?: string;
    price?: number | null;
    items?: { itemId: string; quantity: number }[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'orders',
      permission: {
        resource: 'orders',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de modifier une commande",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    if ((data as { status?: string }).status === 'COMPLETED') {
      return {
        status: 400,
        error: 'Utilisez completeOrder pour terminer une commande',
      };
    }

    const validatedData = updateOrderSchema.parse(data);

    const order = await updateOrderApi(
      {
        ...inventoryScope(dispensaryId),
        id: validatedData.id,
        name: validatedData.name,
        status: validatedData.status,
        type: validatedData.type,
        details: validatedData.details,
        price: validatedData.price,
        items: validatedData.items,
      },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: order as unknown as OrderWithRelations,
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la modification de la commande',
      );
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification de la commande');
    }
  }
}

export async function completeOrder(
  dispensarySlug: string,
  data: {
    id: string;
    name?: string;
    type?: 'INCOMING' | 'OUTGOING';
    details?: string;
    price?: number | null;
    items?: { itemId: string; quantity: number }[];
    skipStock: boolean;
    stockLines?: { itemId: string; quantity: number; chestId: string }[];
    createBankTransaction?: boolean;
    bankTransactionDate?: string | Date | null;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'orders',
      permission: {
        resource: 'orders',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de modifier une commande",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

    const validatedData = completeOrderSchema.parse(data);

    const createBankTransaction = Boolean(validatedData.createBankTransaction);
    let bankTransactionDate: Date | null = null;
    if (createBankTransaction) {
      const featureBlock = await getAppFeatureActionBlock(dispensaryId, 'bank');
      if (featureBlock) {
        return { status: featureBlock.status, error: featureBlock.error };
      }

      const rawDate = validatedData.bankTransactionDate;
      if (rawDate == null) {
        return { status: 400, error: 'La date de transaction bancaire est requise' };
      }
      bankTransactionDate =
        typeof rawDate === 'string' ? parseISO(rawDate) : rawDate;
      if (Number.isNaN(bankTransactionDate.getTime())) {
        return { status: 400, error: 'Date de transaction bancaire invalide' };
      }

      if (validatedData.price != null && validatedData.price <= 0) {
        return {
          status: 400,
          error: 'Un prix de commande est requis pour créer une transaction bancaire',
        };
      }
    }

    const order = await completeOrderApi(
      {
        ...inventoryScope(dispensaryId),
        id: validatedData.id,
        skipStock: validatedData.skipStock,
        stockLines: validatedData.stockLines,
        name: validatedData.name,
        type: validatedData.type,
        details: validatedData.details,
        price: validatedData.price,
        items: validatedData.items,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    let bankWarning: string | undefined;
    if (createBankTransaction && bankTransactionDate) {
      const amount = order.price != null ? Number(order.price) : 0;
      if (amount <= 0) {
        bankWarning = 'Un prix de commande est requis pour créer une transaction bancaire';
      } else {
        const cookie = await bankCookie();
        const bankResult = await createBankTransactionFromOrder({
          dispensaryId,
          orderId: order.id,
          orderName: order.name,
          orderType: order.type,
          amount,
          date: bankTransactionDate,
          company: order.company
            ? {
                name: order.company.name,
                bankAccountNumber: order.company.bankAccountNumber ?? null,
              }
            : null,
          individualCustomer: order.individualCustomer
            ? { name: order.individualCustomer.name }
            : null,
          cookieHeader: cookie.cookieHeader,
        });

        if (!bankResult.ok) {
          bankWarning = bankResult.error;
        }
      }
    }

    return {
      status: 200,
      data: order as unknown as OrderWithRelations,
      ...(bankWarning ? { warning: bankWarning } : {}),
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la finalisation de la commande',
      );
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la finalisation de la commande');
    }
  }
}

export async function deleteOrder(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'orders',
      permission: {
        resource: 'orders',
        action: 'delete',
        message:
          "Permission refusée : vous n'avez pas la permission de supprimer une commande",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteOrderSchema.parse(data);

    await deleteOrderApi(
      { ...inventoryScope(dispensaryId), id: validatedData.id },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la suppression de la commande',
      );
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la commande');
    }
  }
}
