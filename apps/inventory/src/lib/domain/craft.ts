import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';

const recipeInclude = {
  ingredients: {
    include: { usedItem: { select: { id: true, name: true } } },
  },
} as const;

async function validateCraftRecipeItems(
  scopeType: string,
  scopeId: string,
  craftedItemId: string,
  ingredientItemIds: string[],
) {
  const allItemIds = Array.from(new Set([craftedItemId, ...ingredientItemIds]));
  const items = await prisma.item.findMany({
    where: { id: { in: allItemIds }, ...scopeWhere(scopeType, scopeId) },
    select: { id: true },
  });
  if (items.length !== allItemIds.length) {
    return err('Un ou plusieurs objets sont invalides', 400);
  }
  return ok(true);
}

export async function listCraftRecipesByItemId(
  scopeType: string,
  scopeId: string,
  itemId: string,
  onlyEnabled = false,
) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, ...scopeWhere(scopeType, scopeId) },
  });
  if (!item) return err('Objet introuvable', 404);

  const craftRecipes = await prisma.craftRecipe.findMany({
    where: {
      craftedItemId: itemId,
      ...scopeWhere(scopeType, scopeId),
      ...(onlyEnabled ? { isEnabled: true } : {}),
    },
    include: recipeInclude,
    orderBy: { createdAt: 'desc' },
  });
  return ok(craftRecipes);
}

export async function createCraftRecipe(input: {
  scopeType: string;
  scopeId: string;
  name: string;
  description?: string | null;
  craftedItemId: string;
  quantity: number;
  isEnabled?: boolean;
  ingredients: { usedItemId: string; quantity: number }[];
}): Promise<DomainResult<unknown>> {
  const check = await validateCraftRecipeItems(
    input.scopeType,
    input.scopeId,
    input.craftedItemId,
    input.ingredients.map((i) => i.usedItemId),
  );
  if (!check.ok) return check;

  const craftRecipe = await prisma.craftRecipe.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
      description: input.description ?? undefined,
      craftedItemId: input.craftedItemId,
      quantity: input.quantity,
      isEnabled: input.isEnabled ?? true,
      ingredients: {
        create: input.ingredients.map((ing) => ({
          usedItemId: ing.usedItemId,
          quantity: ing.quantity,
        })),
      },
    },
    include: recipeInclude,
  });
  return ok(craftRecipe, 201);
}

export async function updateCraftRecipe(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  isEnabled?: boolean;
  ingredients: { usedItemId: string; quantity: number }[];
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.craftRecipe.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    select: { craftedItemId: true },
  });
  if (!existing) return err('Recette de craft introuvable', 404);

  const check = await validateCraftRecipeItems(
    input.scopeType,
    input.scopeId,
    existing.craftedItemId,
    input.ingredients.map((i) => i.usedItemId),
  );
  if (!check.ok) return check;

  await prisma.craftRecipeItem.deleteMany({
    where: {
      craftRecipeId: input.id,
      craftRecipe: scopeWhere(input.scopeType, input.scopeId),
    },
  });

  const craftRecipe = await prisma.craftRecipe.update({
    where: { id: input.id },
    data: {
      name: input.name,
      description: input.description ?? undefined,
      quantity: input.quantity,
      isEnabled: input.isEnabled ?? true,
      ingredients: {
        create: input.ingredients.map((ing) => ({
          usedItemId: ing.usedItemId,
          quantity: ing.quantity,
        })),
      },
    },
    include: recipeInclude,
  });
  return ok(craftRecipe);
}

export async function deleteCraftRecipe(input: {
  scopeType: string;
  scopeId: string;
  id: string;
}): Promise<DomainResult<{ success: true }>> {
  const existing = await prisma.craftRecipe.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Recette de craft introuvable', 404);
  await prisma.craftRecipe.delete({ where: { id: input.id } });
  return ok({ success: true });
}
