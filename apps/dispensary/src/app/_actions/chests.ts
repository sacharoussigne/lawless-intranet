'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createChest as createChestClient,
  deleteChest as deleteChestClient,
  listChests,
  listChestsLite,
  reorderChests as reorderChestsClient,
  updateChest as updateChestClient,
} from '@lawless-intranet/inventory-client/server';
import type { ChestRecord } from '@lawless-intranet/types';

const createChestSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  isEnabled: z.boolean().default(true),
});

const updateChestSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  isEnabled: z.boolean(),
});

const deleteChestSchema = z.object({
  id: z.string().uuid('ID invalide'),
  targetChestId: z.string().uuid('ID de coffre de destination invalide'),
});

const reorderChestsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid('ID invalide'),
    order: z.number().int(),
  })),
});

export type GetChestsListOptions = {
  bypassAccessFilter?: boolean;
};

export async function createChest(
  dispensarySlug: string,
  data: {
    name: string;
    description?: string;
    isEnabled?: boolean;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createChestSchema.parse(data);
    const chest = await createChestClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 201, data: chest };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création du coffre');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création du coffre');
    }
  }
}

export async function getChests(dispensarySlug: string, onlyEnabled: boolean = false) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const chests = (await listChests(
      {
        ...inventoryScope(dispensaryId),
        onlyEnabled: onlyEnabled || undefined,
      },
      await inventoryCookie(),
    )) as ChestRecord[];

    return { status: 200, data: chests };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des coffres');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des coffres');
    }
  }
}

export async function getChestsList(
  dispensarySlug: string,
  onlyEnabled: boolean = false,
  options: GetChestsListOptions = {},
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

    const chests = await listChestsLite(
      {
        ...inventoryScope(dispensaryId),
        onlyEnabled: onlyEnabled || undefined,
        effectiveRole,
        bypassAccessFilter: options.bypassAccessFilter || undefined,
      },
      await inventoryCookie(),
    );

    return { status: 200, data: chests };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des coffres');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des coffres');
    }
  }
}

export async function updateChest(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    isEnabled?: boolean;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateChestSchema.parse(data);
    const chest = await updateChestClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: chest };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la modification du coffre');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification du coffre');
    }
  }
}

export async function deleteChest(
  dispensarySlug: string,
  data: { id: string; targetChestId: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteChestSchema.parse(data);
    await deleteChestClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la suppression du coffre');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression du coffre');
    }
  }
}

export async function reorderChests(
  dispensarySlug: string,
  data: { items: { id: string; order: number }[] },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = reorderChestsSchema.parse(data);
    await reorderChestsClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors du réordonnancement des coffres');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du réordonnancement des coffres');
    }
  }
}
