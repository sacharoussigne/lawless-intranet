import type { InventoryActionResult, InventoryUiActions } from '@lawless-intranet/inventory-ui';
import { toUiResult } from '@lawless-intranet/host-kit/action';
import { getCraftRecipesByItemId } from '@/app/_actions/craftRecipes';
import { craftItem, updateStock } from '@/app/_actions/stock/mutations';
import {
  getItemsWithStock,
  getLastStockDaysByChest,
} from '@/app/_actions/stock/queries';
import { moveItemsWithChests } from '@/app/_actions/stock/take';
import { transferMultipleStock } from '@/app/_actions/stock/transfer';
import { getStockChecksSummary } from '@/app/_actions/stockChecks';
import {
  getChestStockVisibility,
  setChestCategoryHidden,
  setChestItemHidden,
} from '@/app/_actions/stockVisibility';

export function createDispensaryInventoryActions(dispensarySlug: string): InventoryUiActions {
  return {
    getItemsWithStock: (chestId) =>
      toUiResult(getItemsWithStock(dispensarySlug, chestId)),
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
    getStockChecksSummary: () => toUiResult(getStockChecksSummary(dispensarySlug)),
    getChestStockVisibility: (chestId) =>
      toUiResult(getChestStockVisibility(dispensarySlug, chestId)),
    setChestCategoryHidden: (input) =>
      toUiResult(setChestCategoryHidden(dispensarySlug, input)),
    setChestItemHidden: (input) => toUiResult(setChestItemHidden(dispensarySlug, input)),
    getLastStockDaysByChest: () => toUiResult(getLastStockDaysByChest(dispensarySlug)),
    getCraftRecipesByItemId: async (itemId, onlyEnabled) => {
      const result = await toUiResult(
        getCraftRecipesByItemId(dispensarySlug, itemId, onlyEnabled),
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
