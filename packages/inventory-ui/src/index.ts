export {
  InventoryUiProvider,
  type InventoryUiActions,
  type InventoryUiContextValue,
  type InventoryUiProviderProps,
} from './InventoryUiProvider';

export { default as StockPage, type StockPageProps } from './stock/StockPage';
export { default as TakeDepositModal } from './stock/modals/TakeModal';

export type {
  InventoryActionResult,
  InventoryUiPermissions,
  ItemWithRelations,
  ChestListItem,
  StockChecksSummary,
  StockUiPreferences,
} from './types';
