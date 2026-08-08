'use server';

import type {
  SaleItemSource as SaleItemSourceType,
  SaleStatus as SaleStatusType,
} from '@lawless-intranet/inventory-client';
import {
  cancelSale as cancelSaleApi,
  createSale as createSaleApi,
  deleteSale as deleteSaleApi,
  depositSale as depositSaleApi,
  getSellableItems as getSellableItemsApi,
  listWeeklySales as listWeeklySalesApi,
} from '@lawless-intranet/inventory-client/server';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { checkRolePermission, hasRole } from '@lawless-intranet/auth-permissions';
import { fetchUserProfiles } from '@/lib/authUsers';
import { getBankWeekBounds } from '@/lib/bankWeek';
import {
  inventoryActionError,
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { Role } from '@/types/enum/roles';
import {
  emitWeeklySalesChange,
  saleToWeeklySalesRealtimePayload,
} from '@/lib/sales/realtime/broadcast';
import type { SalesMutationMeta } from '@/lib/sales/realtime/types';

const saleItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  source: z.enum(['POCKET', 'CHEST']),
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

const salesMutationMetaSchema = z
  .object({
    originClientId: z.string().min(1).max(128).optional(),
  })
  .optional();

function parseMutationMeta(meta: unknown): SalesMutationMeta | undefined {
  const parsed = salesMutationMetaSchema.safeParse(meta);
  if (!parsed.success || !parsed.data?.originClientId) {
    return undefined;
  }
  return { originClientId: parsed.data.originClientId };
}

async function emitSaleRealtime(
  dispensaryId: string,
  sale: { id: string; userId: string; createdAt: Date | string },
  meta?: SalesMutationMeta,
) {
  const createdAt =
    typeof sale.createdAt === 'string' ? new Date(sale.createdAt) : sale.createdAt;
  const bounds = getBankWeekBounds(createdAt);
  await emitWeeklySalesChange(
    dispensaryId,
    saleToWeeklySalesRealtimePayload({
      id: sale.id,
      userId: sale.userId,
      periodStart: bounds.start,
      periodEnd: bounds.end,
    }),
    meta,
  );
}

export type SaleListItem = {
  id: string;
  userId: string;
  userName: string;
  status: SaleStatusType;
  createdAt: Date;
  cancelledAt: Date | null;
  depositedInCashRegister: boolean;
  depositedInCashRegisterAt: Date | null;
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
    source: SaleItemSourceType;
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

function mapWeeklySaleRow(
  sale: {
    id: string;
    userId: string;
    status: SaleStatusType;
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
      source: SaleItemSourceType;
      chestId: string | null;
      chestName: string | null;
    }[];
  },
  userNameById: Map<string, string>,
): SaleListItem {
  return {
    id: sale.id,
    userId: sale.userId,
    userName: userNameById.get(sale.userId) ?? 'Utilisateur',
    status: sale.status,
    createdAt: new Date(sale.createdAt),
    cancelledAt: sale.cancelledAt ? new Date(sale.cancelledAt) : null,
    depositedInCashRegister: sale.depositedInCashRegister,
    depositedInCashRegisterAt: sale.depositedInCashRegisterAt
      ? new Date(sale.depositedInCashRegisterAt)
      : null,
    customerName: sale.customerName,
    description: sale.description,
    priceAdjustment: sale.priceAdjustment,
    subtotalAmount: sale.subtotalAmount,
    totalAmount: sale.totalAmount,
    totalQuantity: sale.totalQuantity,
    items: sale.items,
  };
}

export async function createSale(
  dispensarySlug: string,
  rawData: z.infer<typeof createSaleSchema>,
  meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'sales',
      permission: {
        resource: 'sales',
        action: 'create',
        message:
          "Permission refusée : vous n'avez pas la permission de créer une vente",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const userId = ctx.session.user.id;
    const mutationMeta = parseMutationMeta(meta);

    const data = createSaleSchema.parse(rawData);

    const sale = await createSaleApi(
      {
        ...inventoryScope(dispensaryId),
        userId,
        defaultChestId: data.defaultChestId,
        customerName: data.customerName,
        description: data.description,
        individualCustomerId: data.individualCustomerId,
        priceAdjustment: data.priceAdjustment ?? 0,
        items: data.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          source: item.source,
          chestId: item.chestId,
        })),
        effectiveRole,
      },
      await inventoryCookie(),
    );

    // Inventory createSale returns the list-item shape (with totals / item names).
    const listItem = sale as unknown as Parameters<typeof mapWeeklySaleRow>[0];

    await emitSaleRealtime(
      dispensaryId,
      { id: listItem.id, userId: listItem.userId, createdAt: listItem.createdAt },
      mutationMeta,
    );

    return {
      status: 200,
      data: mapWeeklySaleRow(
        listItem,
        new Map([[userId, ctx.session.user.name ?? 'Utilisateur']]),
      ),
    };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création de la vente');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la vente');
    }
  }
}

export async function cancelSale(
  dispensarySlug: string,
  saleId: string,
  meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'sales',
      permission: {
        resource: 'sales',
        action: 'cancel',
        message:
          "Permission refusée : vous n'avez pas la permission d'annuler une vente",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const userId = ctx.session.user.id;
    const canViewAll = checkRolePermission(effectiveRole, 'sales', 'view_all');
    const mutationMeta = parseMutationMeta(meta);

    const sale = await cancelSaleApi(
      {
        ...inventoryScope(dispensaryId),
        id: saleId,
        userId,
        canViewAll,
      },
      await inventoryCookie(),
    );

    await emitSaleRealtime(
      dispensaryId,
      {
        id: saleId,
        userId: (sale as { userId?: string }).userId ?? userId,
        createdAt: (sale as { createdAt?: string }).createdAt ?? new Date(),
      },
      mutationMeta,
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, "Erreur lors de l'annulation de la vente");
    } catch (e) {
      return actionErrorParser(e, "Erreur lors de l'annulation de la vente");
    }
  }
}

export async function depositSaleInCashRegister(
  dispensarySlug: string,
  saleId: string,
  meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'sales',
      permission: {
        resource: 'sales',
        action: 'view',
        message:
          "Permission refusée : vous n'avez pas la permission de consulter les ventes",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const userId = ctx.session.user.id;
    const canDepositOthers =
      hasRole(effectiveRole, Role.ADMIN) || hasRole(effectiveRole, Role.DIRECTION);
    const mutationMeta = parseMutationMeta(meta);

    const sale = await depositSaleApi(
      {
        ...inventoryScope(dispensaryId),
        id: saleId,
        userId,
        canDepositOthers,
      },
      await inventoryCookie(),
    );

    await emitSaleRealtime(
      dispensaryId,
      {
        id: saleId,
        userId: (sale as { userId?: string }).userId ?? userId,
        createdAt: (sale as { createdAt?: string }).createdAt ?? new Date(),
      },
      mutationMeta,
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors du dépôt en caisse');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du dépôt en caisse');
    }
  }
}

export async function deleteSale(
  dispensarySlug: string,
  saleId: string,
  meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'sales',
      permission: {
        resource: 'sales',
        action: 'view_all',
        message:
          "Permission refusée : vous n'avez pas la permission de supprimer une vente",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const userId = ctx.session.user.id;
    const mutationMeta = parseMutationMeta(meta);

    if (!hasRole(effectiveRole, Role.ADMIN)) {
      return { status: 403, error: 'Seuls les administrateurs peuvent supprimer une vente' };
    }

    await deleteSaleApi(
      {
        ...inventoryScope(dispensaryId),
        id: saleId,
        userId,
        isAdmin: true,
      },
      await inventoryCookie(),
    );

    await emitSaleRealtime(
      dispensaryId,
      { id: saleId, userId, createdAt: new Date() },
      mutationMeta,
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la suppression de la vente');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la vente');
    }
  }
}

export async function listWeeklySales(
  dispensarySlug: string,
  weekDate?: Date,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'sales',
      permission: {
        resource: 'sales',
        action: 'view',
        message:
          "Permission refusée : vous n'avez pas la permission de consulter les ventes",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;
    const canViewAll = checkRolePermission(effectiveRole, 'sales', 'view_all');

    const weekly = await listWeeklySalesApi(
      {
        ...inventoryScope(dispensaryId),
        weekDate: weekDate?.toISOString(),
        canViewAll,
      },
      await inventoryCookie(),
    );

    const userIds = Array.from(
      new Set([
        ...weekly.sales.map((sale) => sale.userId),
        ...weekly.byUser.map((row) => row.userId),
      ]),
    );
    const profiles = await fetchUserProfiles(userIds);
    const userNameById = new Map(
      Array.from(profiles.entries()).map(([id, profile]) => [id, profile.name]),
    );

    const mapped = weekly.sales.map((sale) => mapWeeklySaleRow(sale, userNameById));

    const summary: WeeklySalesSummary = {
      periodStart: new Date(weekly.periodStart),
      periodEnd: new Date(weekly.periodEnd),
      totalAmount: weekly.totalAmount,
      totalQuantity: weekly.totalQuantity,
      completedCount: weekly.completedCount,
      cancelledCount: weekly.cancelledCount,
      sales: mapped,
      byUser: weekly.byUser
        .map((row) => ({
          userId: row.userId,
          userName: userNameById.get(row.userId) ?? 'Utilisateur',
          totalAmount: row.totalAmount,
          totalQuantity: row.totalQuantity,
          completedCount: row.completedCount,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount),
    };

    return { status: 200, data: summary };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des ventes',
      );
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des ventes');
    }
  }
}

export async function getSellableItems(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'sales',
      permission: {
        resource: 'sales',
        action: 'create',
        message: 'Permission refusée',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const items = await getSellableItemsApi(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: items,
    };
  } catch (error) {
    try {
      return inventoryActionError(
        error,
        'Erreur lors de la récupération des objets vendables',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des objets vendables',
      );
    }
  }
}
