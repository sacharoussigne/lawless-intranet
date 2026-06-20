'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import {
  deleteStockMovements,
  getStockMovementReconciliation,
  getStockMovementsPage,
  updateStockMovement,
} from '@/app/_actions/stock';
import { getChestsList } from '@/app/_actions/chests';
import { getItems } from '@/app/_actions/items';
import { handleAction } from '@/lib/action';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { stockKeys } from '@/lib/stock/queryKeys';
import type {
  StockMovementListItem,
  StockMovementReconciliationResult,
  StockMovementsPageFilters,
  StockMovementsPageResult,
} from '@/types/stock';
import type { StockMovementsSharedFilters } from '../components/StockMovementsFilters';
import type { StockMovementKind } from '@prisma/client';

export const DEFAULT_MOVEMENTS_PAGE_SIZE = 25;

export const defaultStockMovementsPageFilters: StockMovementsPageFilters = {
  page: 1,
  pageSize: DEFAULT_MOVEMENTS_PAGE_SIZE,
  chestFilter: 'all',
};

function isDefaultMovementsPage(filters: StockMovementsPageFilters): boolean {
  return (
    filters.page === 1 &&
    filters.pageSize === DEFAULT_MOVEMENTS_PAGE_SIZE &&
    !filters.itemId &&
    (!filters.chestFilter || filters.chestFilter === 'all') &&
    !filters.from &&
    !filters.to
  );
}

async function fetchStockMovementsPage(
  dispensarySlug: string,
  filters: StockMovementsPageFilters,
) {
  const result = await getStockMovementsPage(dispensarySlug, {
    page: filters.page,
    pageSize: filters.pageSize,
    itemSearch: filters.itemSearch || undefined,
    itemId: filters.itemId,
    chestFilter: filters.chestFilter,
    kind: filters.kind as StockMovementKind | undefined,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  });
  return handleAction(result) as StockMovementsPageResult;
}

export function useStockMovementsPage(
  filters: StockMovementsPageFilters,
  options?: { initialData?: StockMovementsPageResult; enabled?: boolean },
) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: stockKeys.movementsPage(dispensarySlug, filters),
    queryFn: () => fetchStockMovementsPage(dispensarySlug, filters),
    initialData:
      options?.initialData && isDefaultMovementsPage(filters)
        ? options.initialData
        : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(dispensarySlug) && (options?.enabled ?? true),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useChestsListForMovements() {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: [...stockKeys.all(dispensarySlug), 'chests-list'] as const,
    queryFn: async () => {
      const result = await getChestsList(dispensarySlug, true);
      return handleAction(result) as { id: string; name: string; order: number }[];
    },
    enabled: Boolean(dispensarySlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useItemsListForMovements() {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: [...stockKeys.all(dispensarySlug), 'items-list'] as const,
    queryFn: async () => {
      const result = await getItems(dispensarySlug);
      return handleAction(result) as { id: string; name: string; category: { name: string } }[];
    },
    enabled: Boolean(dispensarySlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useStockMovementReconciliation(
  filters: StockMovementsSharedFilters,
  enabled: boolean,
) {
  const dispensarySlug = useRequiredDispensarySlug();
  const fromKey = filters.from?.slice(0, 10) ?? '';
  const toKey = filters.to?.slice(0, 10) ?? '';

  return useQuery({
    queryKey: stockKeys.reconciliation(
      dispensarySlug,
      filters.itemId ?? '',
      filters.chestFilter,
      fromKey,
      toKey,
    ),
    queryFn: async () => {
      if (!filters.itemId || !filters.from || !filters.to) {
        throw new Error('itemId, from and to are required');
      }
      const result = await getStockMovementReconciliation(dispensarySlug, {
        itemId: filters.itemId,
        chestFilter: filters.chestFilter,
        from: new Date(filters.from),
        to: new Date(filters.to),
      });
      return handleAction(result) as StockMovementReconciliationResult;
    },
    enabled: Boolean(dispensarySlug && filters.itemId && filters.from && filters.to && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useInvalidateStockMovements() {
  const queryClient = useQueryClient();
  const dispensarySlug = useRequiredDispensarySlug();

  return () => {
    void queryClient.invalidateQueries({
      queryKey: [...stockKeys.all(dispensarySlug), 'movements'],
    });
  };
}

export function useUpdateStockMovementMutation() {
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidateStockMovements();

  return useMutation({
    mutationFn: async (vars: {
      id: string;
      quantity?: number;
      kind?: StockMovementKind;
      note?: string | null;
    }) => {
      const result = await updateStockMovement(dispensarySlug, vars);
      return handleAction(result) as StockMovementListItem;
    },
    onSuccess: () => {
      invalidate();
      notifications.show({
        title: 'Succès',
        message: 'Mouvement mis à jour (audit uniquement, stock actuel inchangé)',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la modification',
        color: 'danger',
      });
    },
  });
}

export function useDeleteStockMovementsMutation() {
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidateStockMovements();

  return useMutation({
    mutationFn: async (vars: { ids: string[] }) => {
      const result = await deleteStockMovements(dispensarySlug, vars);
      handleAction(result);
      return vars.ids.length;
    },
    onSuccess: (count) => {
      invalidate();
      notifications.show({
        title: 'Succès',
        message:
          count === 1
            ? 'Mouvement supprimé (audit uniquement, stock actuel inchangé)'
            : `${count} mouvements supprimés (audit uniquement, stock actuel inchangé)`,
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
