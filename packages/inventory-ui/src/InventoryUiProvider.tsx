'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  ChestListItem,
  ChestStockMoveMode,
  ChestStockVisibility,
  CraftRecipeWithIngredients,
  InventoryActionResult,
  InventoryUiPermissions,
  ItemWithDetailedStock,
  ItemWithRelations,
  StockChecksSummary,
} from './types';

export type UpdateStockInput = {
  stockData: { itemId: string; quantity: number }[];
  targetChestId: string | null;
  skipHistory?: boolean;
};

export type CraftItemInput = {
  craftedItemId: string;
  recipeId: string;
  times: number;
  sourceChestId: string | null;
  ingredientChests: { ingredientId: string; chestId: string }[];
  destinationChestId: string | null;
};

export type TransferStockInput = {
  sourceChestId: string;
  destinationChestId: string;
  items: { itemId: string; quantity: number }[];
};

export type MoveItemsWithChestsInput = {
  mode: ChestStockMoveMode;
  items: { itemId: string; quantity: number; chestId: string }[];
};

export type InventoryUiActions = {
  getItemsWithStock: (
    chestId?: string | null,
  ) => Promise<InventoryActionResult<ItemWithRelations[]>>;
  getItemsWithDetailedStock: (
    itemIds?: string[],
  ) => Promise<InventoryActionResult<ItemWithDetailedStock[]>>;
  updateStock: (input: UpdateStockInput) => Promise<InventoryActionResult<unknown>>;
  craftItem: (
    input: CraftItemInput,
  ) => Promise<InventoryActionResult<{ quantityProduced: number }>>;
  transferMultipleStock: (
    input: TransferStockInput,
  ) => Promise<InventoryActionResult<{ success: true }>>;
  moveItemsWithChests: (
    input: MoveItemsWithChestsInput,
  ) => Promise<InventoryActionResult<{ success: true; count: number; mode: ChestStockMoveMode }>>;
  getStockChecksSummary: () => Promise<InventoryActionResult<StockChecksSummary>>;
  getChestStockVisibility: (
    chestId: string,
  ) => Promise<InventoryActionResult<ChestStockVisibility>>;
  setChestCategoryHidden: (input: {
    chestId: string;
    categoryId: string;
    hidden: boolean;
  }) => Promise<InventoryActionResult<{ ok: true }>>;
  setChestItemHidden: (input: {
    chestId: string;
    itemId: string;
    hidden: boolean;
  }) => Promise<InventoryActionResult<{ ok: true }>>;
  getLastStockDaysByChest: () => Promise<InventoryActionResult<Record<string, Date | null>>>;
  getChestsList: (enabledOnly?: boolean) => Promise<InventoryActionResult<ChestListItem[]>>;
  getCraftRecipesByItemId: (
    itemId: string,
    onlyEnabled?: boolean,
  ) => Promise<InventoryActionResult<CraftRecipeWithIngredients[]>>;
};

export type InventoryUiContextValue = {
  scopeKey: string;
  actions: InventoryUiActions;
  permissions: InventoryUiPermissions;
};

const InventoryUiContext = createContext<InventoryUiContextValue | null>(null);

export type InventoryUiProviderProps = {
  scopeKey: string;
  actions: InventoryUiActions;
  permissions: InventoryUiPermissions;
  children: ReactNode;
};

export function InventoryUiProvider({
  scopeKey,
  actions,
  permissions,
  children,
}: InventoryUiProviderProps) {
  const value = useMemo(
    () => ({ scopeKey, actions, permissions }),
    [scopeKey, actions, permissions],
  );
  return (
    <InventoryUiContext.Provider value={value}>{children}</InventoryUiContext.Provider>
  );
}

export function useInventoryUi(): InventoryUiContextValue {
  const context = useContext(InventoryUiContext);
  if (!context) throw new Error('useInventoryUi must be used within InventoryUiProvider');
  return context;
}
