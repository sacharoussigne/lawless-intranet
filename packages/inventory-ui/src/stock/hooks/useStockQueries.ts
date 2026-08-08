'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useInventoryUi } from '../../InventoryUiProvider';
import { unwrapActionResult } from '../../lib/actionResult';
import { normalizeQuantity } from '../../lib/expression';
import { DEFAULT_STALE_TIME_MS, stockKeys } from '../../lib/queryKeys';
import {
  EMPTY_CHEST_STOCK_VISIBILITY,
  type ChestStockVisibility,
} from '../../lib/stockVisibility';
import type {
  ChestStockMoveMode,
  ItemWithRelations,
  StockChecksSummary,
} from '../../types';

export function useStockItems(
  chestId: string | null,
  initialData?: ItemWithRelations[],
  options?: { enabled?: boolean },
) {
  const { scopeKey, actions } = useInventoryUi();

  return useQuery({
    queryKey: stockKeys.items(scopeKey, chestId),
    queryFn: async () => unwrapActionResult(await actions.getItemsWithStock(chestId)),
    initialData: initialData && initialData.length > 0 ? initialData : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(scopeKey) && (options?.enabled ?? true),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useStockChecksSummary(initialData: StockChecksSummary | null) {
  const { scopeKey, actions } = useInventoryUi();

  return useQuery({
    queryKey: stockKeys.checksSummary(scopeKey),
    queryFn: async () => unwrapActionResult(await actions.getStockChecksSummary()),
    initialData: initialData ?? undefined,
    enabled: Boolean(scopeKey),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useLastStockDaysByChest(initialData: Record<string, Date | null>) {
  const { scopeKey, actions } = useInventoryUi();

  return useQuery({
    queryKey: stockKeys.lastStockDays(scopeKey),
    queryFn: async () => unwrapActionResult(await actions.getLastStockDaysByChest()),
    initialData,
    enabled: Boolean(scopeKey),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useChestStockVisibility(chestId: string | null) {
  const { scopeKey, actions } = useInventoryUi();

  return useQuery({
    queryKey: stockKeys.visibility(scopeKey, chestId ?? ''),
    queryFn: async () =>
      unwrapActionResult(await actions.getChestStockVisibility(chestId!)) as ChestStockVisibility,
    enabled: Boolean(scopeKey && chestId),
    staleTime: DEFAULT_STALE_TIME_MS,
    placeholderData: EMPTY_CHEST_STOCK_VISIBILITY,
  });
}

export function useSetChestCategoryHiddenMutation() {
  const { scopeKey, actions } = useInventoryUi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { chestId: string; categoryId: string; hidden: boolean }) => {
      unwrapActionResult(await actions.setChestCategoryHidden(vars));
      return vars;
    },
    onSuccess: (vars) => {
      void queryClient.invalidateQueries({
        queryKey: stockKeys.visibility(scopeKey, vars.chestId),
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors du masquage de la catégorie',
        color: 'danger',
      });
    },
  });
}

export function useSetChestItemHiddenMutation() {
  const { scopeKey, actions } = useInventoryUi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { chestId: string; itemId: string; hidden: boolean }) => {
      unwrapActionResult(await actions.setChestItemHidden(vars));
      return vars;
    },
    onSuccess: (vars) => {
      void queryClient.invalidateQueries({
        queryKey: stockKeys.visibility(scopeKey, vars.chestId),
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || "Erreur lors du masquage de l'objet",
        color: 'danger',
      });
    },
  });
}

export function useInvalidateStockItems() {
  const queryClient = useQueryClient();
  const { scopeKey } = useInventoryUi();

  return (chestIds: Array<string | null>) => {
    const unique = Array.from(new Set(chestIds));
    void queryClient.invalidateQueries({
      queryKey: stockKeys.lastStockDays(scopeKey),
    });
    for (const chestId of unique) {
      void queryClient.invalidateQueries({
        queryKey: stockKeys.items(scopeKey, chestId),
      });
    }
  };
}

export function useUpdateStockMutation() {
  const { actions } = useInventoryUi();
  const invalidateStock = useInvalidateStockItems();

  return useMutation({
    mutationFn: async (vars: {
      stockData: { itemId: string; quantity: number }[];
      targetChestId: string | null;
      skipHistory: boolean;
      chestName: string;
    }) => {
      unwrapActionResult(
        await actions.updateStock({
          stockData: vars.stockData,
          targetChestId: vars.targetChestId,
          skipHistory: vars.skipHistory,
        }),
      );
      return vars;
    },
    onSuccess: (vars) => {
      invalidateStock([null, vars.targetChestId]);
      notifications.show({
        title: 'Succès',
        message: `Stock mis à jour avec succès pour ${vars.chestName}`,
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la sauvegarde du stock',
        color: 'danger',
      });
    },
  });
}

export function useCraftMutation() {
  const { actions } = useInventoryUi();
  const invalidateStock = useInvalidateStockItems();

  return useMutation({
    mutationFn: async (vars: {
      itemId: string;
      recipeId: string;
      times: number;
      sourceChestId: string | null;
      ingredientChests: { ingredientId: string; chestId: string }[];
      destinationChestId: string | null;
      affectedChestIds: Array<string | null>;
    }) => {
      const result = await actions.craftItem({
        craftedItemId: vars.itemId,
        recipeId: vars.recipeId,
        times: vars.times,
        sourceChestId: vars.sourceChestId,
        ingredientChests: vars.ingredientChests,
        destinationChestId: vars.destinationChestId,
      });
      if (result.status !== 200 || result.data === undefined) {
        throw new Error(result.error || 'Craft failed');
      }
      return { ...vars, quantityProduced: result.data.quantityProduced };
    },
    onSuccess: (vars) => {
      invalidateStock([null, ...vars.affectedChestIds]);
    },
  });
}

export function useTransferMutation() {
  const { actions } = useInventoryUi();
  const invalidateStock = useInvalidateStockItems();

  return useMutation({
    mutationFn: async (vars: {
      sourceChestId: string;
      destinationChestId: string;
      items: { itemId: string; quantity: number }[];
    }) => {
      unwrapActionResult(await actions.transferMultipleStock(vars));
      return vars;
    },
    onSuccess: (vars) => {
      invalidateStock([null, vars.sourceChestId, vars.destinationChestId]);
      notifications.show({
        title: 'Succès',
        message: 'Transfert effectué avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors du transfert',
        color: 'danger',
      });
    },
  });
}

export function useChestStockMoveMutation() {
  const { actions } = useInventoryUi();
  const invalidateStock = useInvalidateStockItems();

  return useMutation({
    mutationFn: async (vars: {
      mode: ChestStockMoveMode;
      defaultChestId: string | null;
      items: { itemId: string; quantity: number; chestId: string }[];
    }) => {
      unwrapActionResult(
        await actions.moveItemsWithChests({
          mode: vars.mode,
          items: vars.items,
        }),
      );
      return vars;
    },
    onSuccess: (vars) => {
      const chestIds = vars.items.map((item) => item.chestId);
      invalidateStock([null, vars.defaultChestId, ...chestIds]);
      notifications.show({
        title: 'Succès',
        message: vars.mode === 'take' ? 'Prise enregistrée' : 'Dépôt enregistré',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors du mouvement',
        color: 'danger',
      });
    },
  });
}

export function getChangedStockEntries(
  items: ItemWithRelations[],
  editedQuantitiesByItemId: Record<string, number | null>,
): { itemId: string; quantity: number }[] {
  return items
    .map((item) => {
      const edited = editedQuantitiesByItemId[item.id];
      const normalized = normalizeQuantity(edited);
      const previous = item.stockToday ?? null;
      if (previous === normalized) return null;
      return { itemId: item.id, quantity: normalized };
    })
    .filter((entry): entry is { itemId: string; quantity: number } => entry !== null);
}
