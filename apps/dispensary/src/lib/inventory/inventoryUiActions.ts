import type { InventoryActionResult, InventoryUiActions } from '@lawless-intranet/inventory-ui';
import { getChestsList } from '@/app/_actions/chests';
import { getCraftRecipesByItemId } from '@/app/_actions/craftRecipes';
import { craftItem, updateStock } from '@/app/_actions/stock/mutations';
import {
  getItemsWithDetailedStock,
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

type ActionResponse<T> =
  | { status: number; data: T; error?: undefined }
  | {
      status: number;
      error: string | { field: string | number; message: string }[];
      data?: undefined;
    }
  | { status: number; error?: undefined; data?: undefined; response?: unknown };

async function asInventoryResult<T>(
  promise: Promise<ActionResponse<T>>,
): Promise<InventoryActionResult<T>> {
  const result = await promise;
  if (result && 'data' in result && result.data !== undefined) {
    return { status: result.status, data: result.data };
  }
  const error = 'error' in result ? result.error : undefined;
  const message =
    typeof error === 'string'
      ? error
      : Array.isArray(error)
        ? error.map((e) => e.message).join(', ')
        : 'Erreur';
  return { status: result.status ?? 500, error: message };
}

export function createDispensaryInventoryActions(dispensarySlug: string): InventoryUiActions {
  return {
    getItemsWithStock: (chestId) =>
      asInventoryResult(getItemsWithStock(dispensarySlug, chestId)),
    getItemsWithDetailedStock: (itemIds) =>
      asInventoryResult(getItemsWithDetailedStock(dispensarySlug, itemIds)),
    updateStock: (input) =>
      asInventoryResult(
        updateStock(dispensarySlug, input.stockData, input.targetChestId, {
          skipHistory: input.skipHistory,
        }),
      ),
    craftItem: async (input) => {
      const result = await asInventoryResult(craftItem(dispensarySlug, input));
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
      asInventoryResult(transferMultipleStock(dispensarySlug, input)) as Promise<
        InventoryActionResult<{ success: true }>
      >,
    moveItemsWithChests: (input) =>
      asInventoryResult(moveItemsWithChests(dispensarySlug, input)) as Promise<
        InventoryActionResult<{ success: true; count: number; mode: 'take' | 'deposit' }>
      >,
    getStockChecksSummary: () => asInventoryResult(getStockChecksSummary(dispensarySlug)),
    getChestStockVisibility: (chestId) =>
      asInventoryResult(getChestStockVisibility(dispensarySlug, chestId)),
    setChestCategoryHidden: (input) =>
      asInventoryResult(setChestCategoryHidden(dispensarySlug, input)),
    setChestItemHidden: (input) => asInventoryResult(setChestItemHidden(dispensarySlug, input)),
    getLastStockDaysByChest: () => asInventoryResult(getLastStockDaysByChest(dispensarySlug)),
    getChestsList: (enabledOnly) =>
      asInventoryResult(getChestsList(dispensarySlug, enabledOnly ?? true)),
    getCraftRecipesByItemId: async (itemId, onlyEnabled) => {
      const result = await asInventoryResult(
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
