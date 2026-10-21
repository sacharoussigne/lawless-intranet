'use server';

import { withStockChange } from '@/lib/stock/realtime/broadcast';
import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  getChestStockCheckConfigs as getChestStockCheckConfigsClient,
  getStockChecksSummary as getStockChecksSummaryClient,
  upsertChestStockCheckConfig as upsertChestStockCheckConfigClient,
} from '@lawless-intranet/inventory-client/server';

const upsertChestStockCheckConfigSchema = z.object({
  chestId: z.string().uuid('ID de coffre invalide'),
  isEnabled: z.boolean(),
  categoryIds: z.array(z.string().uuid('ID de catégorie invalide')),
});

export type ChestStockCheckConfigDTO = {
  chestId: string;
  isEnabled: boolean;
  categoryIds: string[];
};

export type CategoryItemDTO = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type ChestStockCheckConfigsResponse = {
  chests: { id: string; name: string; isEnabled: boolean; order: number }[];
  categories: CategoryItemDTO[];
  configsByChestId: Record<string, ChestStockCheckConfigDTO>;
};

export type ChestStockCheckFormResponse = {
  categories: CategoryItemDTO[];
  config: ChestStockCheckConfigDTO | null;
};

export async function getChestStockCheckForm(businessSlug: string, chestId: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      permission: { resource: 'application', action: 'management' },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const data = await getChestStockCheckConfigsClient(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    const payload: ChestStockCheckFormResponse = {
      categories: data.categories,
      config: data.configsByChestId[chestId] ?? null,
    };

    return { status: 200, data: payload };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du chargement de la configuration');
  }
}

export async function getChestStockCheckConfigs(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      permission: { resource: 'application', action: 'management' },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const payload = await getChestStockCheckConfigsClient(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    return { status: 200, data: payload };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du chargement des vérifications de stock');
  }
}

async function upsertChestStockCheckConfigUnlogged(
  businessSlug: string,
  input: {
    chestId: string;
    isEnabled: boolean;
    categoryIds: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      permission: { resource: 'application', action: 'management' },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validated = upsertChestStockCheckConfigSchema.parse(input);
    const config = await upsertChestStockCheckConfigClient(
      { ...inventoryScope(businessId), ...validated },
      await inventoryCookie(),
    );

    return { status: 200, data: config };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la sauvegarde des vérifications de stock');
  }
}

export type StockChecksSummary = {
  enabledChestIds: string[];
  configsByChestId: Record<string, ChestStockCheckConfigDTO>;
};

export async function getStockChecksSummary(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      permission: { resource: 'stock', action: 'view' },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const payload = await getStockChecksSummaryClient(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    return { status: 200, data: payload };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du chargement des vérifications de stock');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function upsertChestStockCheckConfig(
  ...args: Parameters<typeof upsertChestStockCheckConfigUnlogged>
) {
  return withStockChange(
    args[0],
    () =>
      loggedAction(
        {
          feature: 'stock',
          event: 'stockChecks.upsertChestStockCheckConfig',
          target: ([, input]) => input.chestId,
        },
        args,
        () => upsertChestStockCheckConfigUnlogged(...args),
      ),
  );
}
