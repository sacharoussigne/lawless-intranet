import type { InventoryActionResult, InventoryUiActions } from '@lawless-intranet/inventory-ui';
import { toUiResult } from '@lawless-intranet/host-kit/action';
import { craftItem, updateStock } from '@/app/_actions/stock/mutations';
import { moveItemsWithChests } from '@/app/_actions/stock/take';
import { transferMultipleStock } from '@/app/_actions/stock/transfer';
import {
  setChestCategoryHidden,
  setChestItemHidden,
} from '@/app/_actions/stockVisibility';
import { fetchRead } from '@/lib/read/fetchRead';

export function createDispensaryInventoryActions(dispensarySlug: string): InventoryUiActions {
  return {
    // Reads go over GET (lib/read): they do not queue behind server actions.
    getItemsWithStock: (chestId) =>
      toUiResult(fetchRead(dispensarySlug, 'itemsWithStock', { chestId })),
    updateStock: (input) =>
      toUiResult(
        updateStock(dispensarySlug, input.stockData, input.targetChestId, {
          skipHistory: input.skipHistory,
        }),
      ),
    craftItem: async (input) => {
      const result = await toUiResult(craftItem(dispensarySlug, input));
      if (result.data === undefined) {
        return { status: result.status, error: result.error ?? 'Erreur' };
      }
      const quantityProduced =
        result.data &&
        typeof result.data === 'object' &&
        'quantityProduced' in result.data
          ? Number((result.data as { quantityProduced: number }).quantityProduced)
          : 0;
      return { status: result.status, data: { quantityProduced } };
    },
    transferMultipleStock: (input) =>
      toUiResult(transferMultipleStock(dispensarySlug, input)) as Promise<
        InventoryActionResult<{ success: true }>
      >,
    moveItemsWithChests: (input) =>
      toUiResult(moveItemsWithChests(dispensarySlug, input)) as Promise<
        InventoryActionResult<{ success: true; count: number; mode: 'take' | 'deposit' }>
      >,
    getStockChecksSummary: () => toUiResult(fetchRead(dispensarySlug, 'stockChecksSummary')),
    getChestStockVisibility: (chestId) =>
      toUiResult(fetchRead(dispensarySlug, 'chestStockVisibility', { chestId })),
    setChestCategoryHidden: (input) =>
      toUiResult(setChestCategoryHidden(dispensarySlug, input)),
    setChestItemHidden: (input) => toUiResult(setChestItemHidden(dispensarySlug, input)),
    getLastStockDaysByChest: () => toUiResult(fetchRead(dispensarySlug, 'lastStockDaysByChest')),
    getCraftRecipesByItemId: async (itemId, onlyEnabled) => {
      const result = await toUiResult(
        fetchRead(dispensarySlug, 'craftRecipes', { itemId, onlyEnabled }),
      );
      if (result.data === undefined) {
        return { status: result.status, error: result.error ?? 'Erreur' };
      }
      return {
        status: result.status,
        data: result.data.map((recipe) => ({
          ...recipe,
          ingredients: recipe.ingredients ?? [],
        })),
      };
    },
  };
}
