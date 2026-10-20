'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  createCategoryItem,
  updateCategoryItem,
  deleteCategoryItem,
  reorderCategoryItems,
} from '@/app/_actions/categoryItems';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { categoryItemsKeys } from '@/lib/categoryItems/queryKeys';
import { sortCategoryItems } from '@/lib/categoryItems/sortCategoryItems';
import type { CategoryItemWithCount } from '@/types/categoryItems';
import type { CategoryItemRecord } from '@lawless-intranet/types';

async function fetchManagementCategoryItems(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'managementCategoryItems');
  return handleAction(result) as CategoryItemWithCount[];
}

export function useManagementCategoryItems(initialData: CategoryItemWithCount[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: categoryItemsKeys.management(businessSlug),
    queryFn: () => fetchManagementCategoryItems(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function useManagementCategoryItemsCache() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  const queryKey = categoryItemsKeys.management(businessSlug);

  const updateCache = (updater: (items: CategoryItemWithCount[]) => CategoryItemWithCount[]) => {
    queryClient.setQueryData<CategoryItemWithCount[]>(queryKey, (current) => {
      if (!current) return current;
      return sortCategoryItems(updater(current));
    });
  };

  return { updateCache };
}

export function useCreateCategoryItemMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementCategoryItemsCache();

  return useMutation({
    mutationFn: async (vars: { name: string; color?: string }) => {
      const result = await createCategoryItem(businessSlug, vars);
      return handleAction(result) as CategoryItemRecord;
    },
    onSuccess: (created) => {
      updateCache((items) => [
        ...items,
        { ...created, _count: { items: 0 } },
      ]);
      notifications.show({
        title: 'Succès',
        message: 'Catégorie d\'objet créée avec succès',
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

export function useUpdateCategoryItemMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementCategoryItemsCache();

  return useMutation({
    mutationFn: async (vars: { id: string; name: string; color?: string }) => {
      const result = await updateCategoryItem(businessSlug, vars);
      return handleAction(result) as CategoryItemRecord;
    },
    onSuccess: (updated) => {
      updateCache((items) =>
        items.map((item) =>
          item.id === updated.id
            ? { ...item, name: updated.name, color: updated.color }
            : item,
        ),
      );
      notifications.show({
        title: 'Succès',
        message: 'Catégorie d\'objet modifiée avec succès',
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

export function useDeleteCategoryItemMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementCategoryItemsCache();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteCategoryItem(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ id }) => {
      updateCache((items) => items.filter((item) => item.id !== id));
      notifications.show({
        title: 'Succès',
        message: 'Catégorie d\'objet supprimée avec succès',
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

export function useReorderCategoryItemsMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementCategoryItemsCache();

  return useMutation({
    mutationFn: async (vars: { items: { id: string; order: number }[] }) => {
      const result = await reorderCategoryItems(businessSlug, vars);
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
        message: 'Ordre des catégories mis à jour',
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
