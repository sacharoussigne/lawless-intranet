'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createItem as createItemClient,
  deleteItem as deleteItemClient,
  listItems,
  reorderItems as reorderItemsClient,
  updateItem as updateItemClient,
} from '@lawless-intranet/inventory-client/server';

const createItemSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  minimalQuantity: z.number().int().min(0, 'La quantité minimale doit être positive'),
  isCraftable: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  canBeSold: z.boolean().default(false),
  price: z.number().positive('Le prix doit être positif').optional().nullable(),
  weight: z.number().positive('Le poids doit être positif').optional().nullable(),
  categoryId: z.string().uuid('ID de catégorie invalide').min(1, 'La catégorie est requise'),
  companyGroupId: z.string().uuid('ID de groupe d\'entreprise invalide').optional(),
});

const updateItemSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  minimalQuantity: z.number().int().min(0, 'La quantité minimale doit être positive'),
  isCraftable: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  canBeSold: z.boolean().default(false),
  price: z.number().positive('Le prix doit être positif').optional().nullable(),
  weight: z.number().positive('Le poids doit être positif').optional().nullable(),
  categoryId: z.string().uuid('ID de catégorie invalide').min(1, 'La catégorie est requise'),
  companyGroupId: z.string().uuid('ID de groupe d\'entreprise invalide').optional(),
});

const deleteItemSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const reorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid('ID invalide'),
    order: z.number().int(),
  })),
});

export async function createItem(
  dispensarySlug: string,
  data: {
    name: string;
    description?: string;
    minimalQuantity: number;
    isCraftable?: boolean;
    isEnabled?: boolean;
    canBeSold?: boolean;
    price?: number | null;
    weight?: number | null;
    categoryId: string;
    companyGroupId?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createItemSchema.parse(data);
    const item = await createItemClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 201, data: item };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création de l\'objet');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de l\'objet');
    }
  }
}

export async function getItems(
  dispensarySlug: string,
  options?: { companyGroupId?: string | null },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const items = await listItems(
      {
        ...inventoryScope(dispensaryId),
        ...(options?.companyGroupId ? { companyGroupId: options.companyGroupId } : {}),
      },
      await inventoryCookie(),
    );

    return { status: 200, data: items };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des objets');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des objets');
    }
  }
}

export async function updateItem(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    minimalQuantity: number;
    isCraftable?: boolean;
    isEnabled?: boolean;
    canBeSold?: boolean;
    price?: number | null;
    weight?: number | null;
    categoryId: string;
    companyGroupId?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateItemSchema.parse(data);
    const item = await updateItemClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: item };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la modification de l\'objet');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification de l\'objet');
    }
  }
}

export async function deleteItem(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteItemSchema.parse(data);
    await deleteItemClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la suppression de l\'objet');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de l\'objet');
    }
  }
}

export async function reorderItems(
  dispensarySlug: string,
  data: { items: { id: string; order: number }[] },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = reorderItemsSchema.parse(data);
    await reorderItemsClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors du réordonnancement des objets');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du réordonnancement des objets');
    }
  }
}
