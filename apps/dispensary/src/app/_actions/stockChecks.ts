'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
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

export async function getChestStockCheckForm(dispensarySlug: string, chestId: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: { resource: 'application', action: 'management' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const data = await getChestStockCheckConfigsClient(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    const payload: ChestStockCheckFormResponse = {
      categories: data.categories,
      config: data.configsByChestId[chestId] ?? null,
    };

    return { status: 200, data: payload };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors du chargement de la configuration');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement de la configuration');
    }
  }
}

export async function getChestStockCheckConfigs(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: { resource: 'application', action: 'management' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const payload = await getChestStockCheckConfigsClient(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: payload };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors du chargement des vérifications de stock');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement des vérifications de stock');
    }
  }
}

export async function upsertChestStockCheckConfig(
  dispensarySlug: string,
  input: {
    chestId: string;
    isEnabled: boolean;
    categoryIds: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: { resource: 'application', action: 'management' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = upsertChestStockCheckConfigSchema.parse(input);
    const config = await upsertChestStockCheckConfigClient(
      { ...inventoryScope(dispensaryId), ...validated },
      await inventoryCookie(),
    );

    return { status: 200, data: config };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la sauvegarde des vérifications de stock');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la sauvegarde des vérifications de stock');
    }
  }
}

export type StockChecksSummary = {
  enabledChestIds: string[];
  configsByChestId: Record<string, ChestStockCheckConfigDTO>;
};

export async function getStockChecksSummary(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: { resource: 'stock', action: 'view' },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const payload = await getStockChecksSummaryClient(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: payload };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors du chargement des vérifications de stock');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement des vérifications de stock');
    }
  }
}
