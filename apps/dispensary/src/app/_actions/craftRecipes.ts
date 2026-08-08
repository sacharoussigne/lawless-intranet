'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createCraftRecipe as createCraftRecipeClient,
  deleteCraftRecipe as deleteCraftRecipeClient,
  listCraftRecipesByItemId,
  updateCraftRecipe as updateCraftRecipeClient,
} from '@lawless-intranet/inventory-client/server';

const createCraftRecipeSchema = z.object({
  name: z.string().min(1, 'Le nom de la recette est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  craftedItemId: z.string().uuid('ID d\'item invalide'),
  quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
  isEnabled: z.boolean().default(true),
  ingredients: z.array(z.object({
    usedItemId: z.string().uuid('ID d\'item invalide'),
    quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
  })).min(1, 'Au moins un ingrédient est requis'),
});

const updateCraftRecipeSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom de la recette est requis').max(255, 'Le nom est trop long'),
  description: z.string().max(1000, 'La description est trop longue').optional(),
  quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
  isEnabled: z.boolean().default(true),
  ingredients: z.array(z.object({
    usedItemId: z.string().uuid('ID d\'item invalide'),
    quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
  })).min(1, 'Au moins un ingrédient est requis'),
});

const deleteCraftRecipeSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

export async function getCraftRecipesByItemId(
  dispensarySlug: string,
  itemId: string,
  onlyEnabled: boolean = false,
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const craftRecipes = await listCraftRecipesByItemId(
      {
        ...inventoryScope(dispensaryId),
        itemId,
        onlyEnabled: onlyEnabled || undefined,
      },
      await inventoryCookie(),
    );

    return { status: 200, data: craftRecipes };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des recettes de craft');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des recettes de craft');
    }
  }
}

export async function createCraftRecipe(
  dispensarySlug: string,
  data: {
    name: string;
    description?: string;
    craftedItemId: string;
    quantity: number;
    isEnabled?: boolean;
    ingredients: { usedItemId: string; quantity: number }[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createCraftRecipeSchema.parse(data);
    const craftRecipe = await createCraftRecipeClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 201, data: craftRecipe };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la création de la recette de craft');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la recette de craft');
    }
  }
}

export async function updateCraftRecipe(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    isEnabled?: boolean;
    ingredients: { usedItemId: string; quantity: number }[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateCraftRecipeSchema.parse(data);
    const craftRecipe = await updateCraftRecipeClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: craftRecipe };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la modification de la recette de craft');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification de la recette de craft');
    }
  }
}

export async function deleteCraftRecipe(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteCraftRecipeSchema.parse(data);
    await deleteCraftRecipeClient(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la suppression de la recette de craft');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la recette de craft');
    }
  }
}
