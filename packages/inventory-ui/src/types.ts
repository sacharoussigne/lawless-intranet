import type {
  CategoryItemRecord,
  ChestLiteRecord,
  ChestRecord,
  ChestStockVisibilityRecord,
  CraftRecipeItemRecord,
  CraftRecipeRecord,
  ItemRecord,
  StockChecksSummaryRecord,
  StockItemWithStockRecord,
  StockMovementKind,
  StockMovementRecord,
  StockMovementsPageRecord,
  StockStatsRecord,
} from '@lawless-intranet/types';

export type InventoryActionResult<T = void> =
  | { status: number; data: T; error?: undefined }
  | { status: number; error: string; data?: undefined };

export type ItemWithRelations = StockItemWithStockRecord;
export type ItemWithDetailedStock = StockItemWithStockRecord;
export type ChestListItem = ChestLiteRecord;
export type ChestWithStockHistory = ChestRecord;

export type CategoryWithItems = {
  category: { id: string; name: string; color: string; order?: number };
  items: ItemWithRelations[];
};

export type CraftRecipeItemWithItem = CraftRecipeItemRecord;
export type CraftRecipeWithIngredients = CraftRecipeRecord & {
  ingredients: CraftRecipeItemWithItem[];
};

export type StockChecksSummary = StockChecksSummaryRecord;
export type ChestStockVisibility = ChestStockVisibilityRecord;

export type StockUiPreferences = {
  lowStockCraftableBg: string;
  lowStockNormalBg: string;
  okStockBg: string | null;
  unknownStockBg: string | null;
  doneTodayBadgeBg: string | null;
};

export const STOCK_UI_DEFAULTS: StockUiPreferences = {
  lowStockCraftableBg: '#faf2d7',
  lowStockNormalBg: '#f5e4e5',
  okStockBg: null,
  unknownStockBg: null,
  doneTodayBadgeBg: null,
};

export type ChestStockMoveMode = 'take' | 'deposit';

export type InventoryStockPermissions = {
  update: boolean;
  hide: boolean;
  craftRead?: boolean;
  craftWrite?: boolean;
};

export type InventoryUiPermissions = {
  stock: InventoryStockPermissions;
};

export type {
  CategoryItemRecord,
  ChestLiteRecord,
  ChestRecord,
  ChestStockVisibilityRecord,
  CraftRecipeItemRecord,
  CraftRecipeRecord,
  ItemRecord,
  StockChecksSummaryRecord,
  StockItemWithStockRecord,
  StockMovementKind,
  StockMovementRecord,
  StockMovementsPageRecord,
  StockStatsRecord,
};
