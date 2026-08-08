import type {
  InventoryScopeParams as InventoryScopeParamsType,
  SaleItemSource as SaleItemSourceType,
  SaleStatus as SaleStatusType,
  OrderStatus as OrderStatusType,
  OrderType as OrderTypeType,
  StockMovementKind as StockMovementKindType,
} from '@lawless-intranet/types';

export type InventoryScopeParams = InventoryScopeParamsType;
export type OrderStatus = OrderStatusType;
export type OrderType = OrderTypeType;
export type SaleItemSource = SaleItemSourceType;
export type SaleStatus = SaleStatusType;
export type StockMovementKind = StockMovementKindType;

export const SaleStatus = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<SaleStatus, SaleStatus>;

export const SaleItemSource = {
  POCKET: 'POCKET',
  CHEST: 'CHEST',
} as const satisfies Record<SaleItemSource, SaleItemSource>;

export type ReorderItem = { id: string; order: number };

export type OrderItemInput = { itemId: string; quantity: number };

export type CraftIngredientInput = { usedItemId: string; quantity: number };

export type SaleItemInput = {
  itemId: string;
  quantity: number;
  source: SaleItemSource;
  chestId?: string | null;
};
