'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  createChest,
  updateChest,
  deleteChest,
  reorderChests,
} from '@/app/_actions/chests';
import {
  upsertRoleChestAccess,
  type RoleChestAccessRow,
} from '@/app/_actions/chestAccess';
import {
  upsertChestStockCheckConfig,
} from '@/app/_actions/stockChecks';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { chestsKeys } from '@/lib/chests/queryKeys';
import { sortChests } from '@/lib/chests/sortChests';
import { stockKeys } from '@/lib/stock/queryKeys';
import type { ChestWithStockHistory } from '@/types/chests';
import type { ChestStockCheckFormResponse } from '@/app/_actions/stockChecks';

async function fetchManagementChests(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'chests');
  return handleAction(result) as ChestWithStockHistory[];
}

async function fetchRoleChestAccesses(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'roleChestAccesses');
  return handleAction(result) as RoleChestAccessRow[];
}

async function fetchChestStockCheckForm(businessSlug: string, chestId: string) {
  const result = await fetchRead(businessSlug, 'chestStockCheckForm', { chestId });
  return handleAction(result) as ChestStockCheckFormResponse;
}

export function useManagementChests(initialData: ChestWithStockHistory[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: chestsKeys.management(businessSlug),
    queryFn: () => fetchManagementChests(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useRoleChestAccesses(initialData: RoleChestAccessRow[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: chestsKeys.roleAccess(businessSlug),
    queryFn: () => fetchRoleChestAccesses(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useChestStockCheckForm(chestId: string | null, opened: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: chestsKeys.stockCheckForm(businessSlug, chestId ?? ''),
    queryFn: () => {
      if (!chestId) throw new Error('chestId is required');
      return fetchChestStockCheckForm(businessSlug, chestId);
    },
    enabled: Boolean(chestId) && opened,
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function useManagementChestsCache() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  const queryKey = chestsKeys.management(businessSlug);

  const updateCache = (updater: (chests: ChestWithStockHistory[]) => ChestWithStockHistory[]) => {
    queryClient.setQueryData<ChestWithStockHistory[]>(queryKey, (current) => {
      if (!current) return current;
      return sortChests(updater(current));
    });
  };

  const invalidateManagement = () => {
    queryClient.invalidateQueries({ queryKey: chestsKeys.management(businessSlug) });
  };

  const invalidateRoleAccess = () => {
    queryClient.invalidateQueries({ queryKey: chestsKeys.roleAccess(businessSlug) });
  };

  const invalidateStockChecksSummary = () => {
    queryClient.invalidateQueries({ queryKey: stockKeys.checksSummary(businessSlug) });
  };

  const invalidateStockCheckForm = (chestId: string) => {
    queryClient.invalidateQueries({
      queryKey: chestsKeys.stockCheckForm(businessSlug, chestId),
    });
  };

  return {
    updateCache,
    invalidateManagement,
    invalidateRoleAccess,
    invalidateStockChecksSummary,
    invalidateStockCheckForm,
  };
}

export function useUpsertRoleChestAccessMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { invalidateRoleAccess } = useManagementChestsCache();

  return useMutation({
    mutationFn: async (vars: {
      role: string;
      allChests: boolean;
      chestIds?: string[];
    }) => {
      const result = await upsertRoleChestAccess(businessSlug, vars);
      return handleAction(result) as RoleChestAccessRow;
    },
    onSuccess: () => {
      invalidateRoleAccess();
      notifications.show({
        title: 'Succès',
        message: 'Accès aux coffres mis à jour',
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

export function useCreateChestMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementChestsCache();

  return useMutation({
    mutationFn: async (vars: {
      name: string;
      description?: string;
      isEnabled?: boolean;
    }) => {
      const result = await createChest(businessSlug, vars);
      return handleAction(result);
    },
    onSuccess: (created) => {
      if (!created) return;
      updateCache((chests) => [
        ...chests,
        { ...created, stockHistoryCount: 0 } as ChestWithStockHistory,
      ]);
      notifications.show({
        title: 'Succès',
        message: 'Coffre créé avec succès',
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

export function useUpdateChestMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementChestsCache();

  return useMutation({
    mutationFn: async (vars: {
      id: string;
      name: string;
      description?: string;
      isEnabled?: boolean;
    }) => {
      const result = await updateChest(businessSlug, vars);
      return handleAction(result);
    },
    onSuccess: (updated) => {
      if (!updated) return;
      updateCache((chests) =>
        chests.map((chest) =>
          chest.id === updated.id
            ? { ...chest, ...updated, stockHistoryCount: chest.stockHistoryCount }
            : chest,
        ),
      );
      notifications.show({
        title: 'Succès',
        message: 'Coffre modifié avec succès',
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

export function useDeleteChestMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { invalidateManagement } = useManagementChestsCache();

  return useMutation({
    mutationFn: async (vars: { id: string; targetChestId: string }) => {
      const result = await deleteChest(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: () => {
      invalidateManagement();
      notifications.show({
        title: 'Succès',
        message: 'Coffre supprimé avec succès. Les stocks ont été transférés.',
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

export function useReorderChestsMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementChestsCache();

  return useMutation({
    mutationFn: async (vars: { items: { id: string; order: number }[] }) => {
      const result = await reorderChests(businessSlug, vars);
      handleAction(result);
      return vars.items;
    },
    onSuccess: (items) => {
      const orderById = new Map(items.map(({ id, order }) => [id, order]));
      updateCache((chests) =>
        chests.map((chest) => ({
          ...chest,
          order: orderById.get(chest.id) ?? chest.order,
        })),
      );
      notifications.show({
        title: 'Succès',
        message: 'Ordre des coffres mis à jour',
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

export function useUpsertChestStockCheckConfigMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { invalidateStockChecksSummary, invalidateStockCheckForm } =
    useManagementChestsCache();

  return useMutation({
    mutationFn: async (vars: {
      chestId: string;
      isEnabled: boolean;
      categoryIds: string[];
    }) => {
      const result = await upsertChestStockCheckConfig(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ chestId }) => {
      invalidateStockCheckForm(chestId);
      invalidateStockChecksSummary();
      notifications.show({
        title: 'Succès',
        message: 'Configuration sauvegardée',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    },
  });
}
