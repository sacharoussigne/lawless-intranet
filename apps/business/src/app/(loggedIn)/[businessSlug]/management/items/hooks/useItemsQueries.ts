'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
} from '@/app/_actions/items';
import {
  createCraftRecipe,
  updateCraftRecipe,
  deleteCraftRecipe,
} from '@/app/_actions/craftRecipes';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { itemsKeys } from '@/lib/items/queryKeys';
import { sortItems } from '@/lib/stock/sortItemsByCategory';
import type {
  ItemWithRelations,
  CraftRecipeWithIngredients,
} from '@/types/items';

async function fetchManagementItems(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'items', {});
  return handleAction(result) as ItemWithRelations[];
}

export function useManagementItems(initialData: ItemWithRelations[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: itemsKeys.management(businessSlug),
    queryFn: () => fetchManagementItems(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function useManagementItemsCache() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  const queryKey = itemsKeys.management(businessSlug);

  const updateCache = (updater: (items: ItemWithRelations[]) => ItemWithRelations[]) => {
    queryClient.setQueryData<ItemWithRelations[]>(queryKey, (current) => {
      if (!current) return current;
      return sortItems(updater(current));
    });
  };

  return { updateCache, queryKey };
}

export function useCreateItemMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementItemsCache();

  return useMutation({
    mutationFn: async (vars: Parameters<typeof createItem>[1]) => {
      const result = await createItem(businessSlug, vars);
      return handleAction(result) as ItemWithRelations;
    },
    onSuccess: (created) => {
      updateCache((items) => [...items, created]);
      notifications.show({
        title: 'Succès',
        message: 'Objet créé avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      if (error instanceof ParsedZodError) return;
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    },
  });
}

export function useUpdateItemMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementItemsCache();

  return useMutation({
    mutationFn: async (vars: Parameters<typeof updateItem>[1]) => {
      const result = await updateItem(businessSlug, vars);
      return handleAction(result) as ItemWithRelations;
    },
    onSuccess: (updated) => {
      updateCache((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      notifications.show({
        title: 'Succès',
        message: 'Objet modifié avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      if (error instanceof ParsedZodError) return;
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    },
  });
}

export function useDeleteItemMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementItemsCache();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteItem(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ id }) => {
      updateCache((items) => items.filter((item) => item.id !== id));
      notifications.show({
        title: 'Succès',
        message: 'Objet supprimé avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la suppression',
        color: 'danger',
      });
    },
  });
}

export function useReorderItemsMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementItemsCache();

  return useMutation({
    mutationFn: async (vars: { items: { id: string; order: number }[] }) => {
      const result = await reorderItems(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ items }) => {
      const orderById = new Map(items.map(({ id, order }) => [id, order]));
      updateCache((current) =>
        current.map((item) => ({
          ...item,
          order: orderById.get(item.id) ?? item.order,
        })),
      );
      notifications.show({
        title: 'Succès',
        message: 'Ordre des objets mis à jour',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la mise à jour de l\'ordre',
        color: 'danger',
      });
    },
  });
}

export function useCraftRecipesQuery(itemId: string | null, enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: itemsKeys.craftRecipes(businessSlug, itemId ?? ''),
    queryFn: async () => {
      if (!itemId) throw new Error('itemId is required');
      const result = await fetchRead(businessSlug, 'craftRecipes', { itemId });
      return handleAction(result) as CraftRecipeWithIngredients[];
    },
    enabled: Boolean(businessSlug && itemId && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function useCraftRecipesCache(itemId: string) {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  const queryKey = itemsKeys.craftRecipes(businessSlug, itemId);

  const updateCache = (
    updater: (recipes: CraftRecipeWithIngredients[]) => CraftRecipeWithIngredients[],
  ) => {
    queryClient.setQueryData<CraftRecipeWithIngredients[]>(queryKey, (current) => {
      if (!current) return current;
      return updater(current);
    });
  };

  return { updateCache, queryKey };
}

export function useCreateCraftRecipeMutation(itemId: string) {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useCraftRecipesCache(itemId);

  return useMutation({
    mutationFn: async (vars: Parameters<typeof createCraftRecipe>[1]) => {
      const result = await createCraftRecipe(businessSlug, vars);
      return handleAction(result) as CraftRecipeWithIngredients;
    },
    onSuccess: (created) => {
      updateCache((recipes) => [created, ...recipes]);
      notifications.show({
        title: 'Succès',
        message: 'Recette de craft créée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      if (error instanceof ParsedZodError) return;
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    },
  });
}

export function useUpdateCraftRecipeMutation(itemId: string) {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useCraftRecipesCache(itemId);

  return useMutation({
    mutationFn: async (vars: Parameters<typeof updateCraftRecipe>[1]) => {
      const result = await updateCraftRecipe(businessSlug, vars);
      return handleAction(result) as CraftRecipeWithIngredients;
    },
    onSuccess: (updated) => {
      updateCache((recipes) =>
        recipes.map((recipe) => (recipe.id === updated.id ? updated : recipe)),
      );
      notifications.show({
        title: 'Succès',
        message: 'Recette de craft modifiée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      if (error instanceof ParsedZodError) return;
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    },
  });
}

export function useDeleteCraftRecipeMutation(itemId: string) {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useCraftRecipesCache(itemId);

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteCraftRecipe(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ id }) => {
      updateCache((recipes) => recipes.filter((recipe) => recipe.id !== id));
      notifications.show({
        title: 'Succès',
        message: 'Recette de craft supprimée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la suppression',
        color: 'danger',
      });
    },
  });
}
