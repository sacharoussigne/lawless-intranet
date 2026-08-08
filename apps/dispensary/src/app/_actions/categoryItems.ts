'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  updateCategory,
} from '@lawless-intranet/inventory-client/server';

const createCategoryItemSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  color: z.string().min(1, 'La couleur est requise').max(7, 'La couleur doit être au format hexadécimal').default('#ffffff'),
});

const updateCategoryItemSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  color: z.string().min(1, 'La couleur est requise').max(7, 'La couleur doit être au format hexadécimal').default('#ffffff'),
});

const deleteCategoryItemSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const reorderCategoryItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid('ID invalide'),
    order: z.number().int(),
  })),
});

export async function createCategoryItem(
  dispensarySlug: string,
  data: {
    name: string;
    color?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createCategoryItemSchema.parse(data);
    const categoryItem = await createCategory(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 201, data: categoryItem };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création de la catégorie d\'objet');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la catégorie d\'objet');
    }
  }
}

export async function getManagementCategoryItems(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const categoryItems = await listCategories(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    return { status: 200, data: categoryItems };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des catégories d\'objets');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des catégories d\'objets');
    }
  }
}

export async function updateCategoryItem(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    color?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateCategoryItemSchema.parse(data);
    const categoryItem = await updateCategory(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: categoryItem };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la modification de la catégorie d\'objet');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification de la catégorie d\'objet');
    }
  }
}

export async function deleteCategoryItem(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteCategoryItemSchema.parse(data);
    await deleteCategory(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la suppression de la catégorie d\'objet');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la catégorie d\'objet');
    }
  }
}

export async function reorderCategoryItems(
  dispensarySlug: string,
  data: { items: { id: string; order: number }[] },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = reorderCategoryItemsSchema.parse(data);
    await reorderCategories(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors du réordonnancement des catégories d\'objets');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du réordonnancement des catégories d\'objets');
    }
  }
}
