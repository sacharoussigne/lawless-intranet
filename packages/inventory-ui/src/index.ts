export {
  InventoryUiProvider,
  useInventoryUi,
  type InventoryUiActions,
  type InventoryUiContextValue,
  type InventoryUiProviderProps,
  type UpdateStockInput,
  type CraftItemInput,
  type TransferStockInput,
  type MoveItemsWithChestsInput,
} from './InventoryUiProvider';

export { default as StockPage, type StockPageProps } from './stock/StockPage';
export { default as TakeDepositModal } from './stock/modals/TakeModal';
export { default as TransferModal } from './stock/modals/TransferModal';
export { default as CraftModal } from './stock/modals/CraftModal';

// Orders / sales / management pages can be extracted later; provider actions cover stock today.
export type {
  InventoryActionResult,
  InventoryUiPermissions,
  InventoryStockPermissions,
  ItemWithRelations,
  ItemWithDetailedStock,
  ChestListItem,
  CategoryWithItems,
  CraftRecipeWithIngredients,
  StockChecksSummary,
  ChestStockVisibility,
  StockUiPreferences,
  ChestStockMoveMode,
} from './types';
export { STOCK_UI_DEFAULTS } from './types';
