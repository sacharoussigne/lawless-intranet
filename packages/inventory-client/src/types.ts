import type {
  InventoryScopeParams as InventoryScopeParamsType,
  OrderStatus as OrderStatusType,
  OrderType as OrderTypeType,
  SaleItemSource as SaleItemSourceType,
  SaleStatus as SaleStatusType,
  StockMovementKind as StockMovementKindType,
} from '@lawless-intranet/types';

export type InventoryScopeParams = InventoryScopeParamsType;
export type OrderStatus = OrderStatusType;
export type OrderType = OrderTypeType;
export type SaleItemSource = SaleItemSourceType;
export type SaleStatus = SaleStatusType;
export type StockMovementKind = StockMovementKindType;

export const OrderStatus = {
  DRAFT: 'DRAFT',
  LETTER_SENT: 'LETTER_SENT',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<OrderStatus, OrderStatus>;

export const OrderType = {
  INCOMING: 'INCOMING',
  OUTGOING: 'OUTGOING',
} as const satisfies Record<OrderType, OrderType>;

export const SaleStatus = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<SaleStatus, SaleStatus>;

export const SaleItemSource = {
  POCKET: 'POCKET',
  CHEST: 'CHEST',
} as const satisfies Record<SaleItemSource, SaleItemSource>;

export const StockMovementKind = {
  MANUAL_FIRST_COUNT: 'MANUAL_FIRST_COUNT',
  MANUAL_ADJUST: 'MANUAL_ADJUST',
  CRAFT_CONSUME: 'CRAFT_CONSUME',
  CRAFT_PRODUCE: 'CRAFT_PRODUCE',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  OVERWRITE: 'OVERWRITE',
  TAKE_OUT: 'TAKE_OUT',
  DEPOSIT_IN: 'DEPOSIT_IN',
  SALE_OUT: 'SALE_OUT',
  SALE_CANCEL_RESTORE: 'SALE_CANCEL_RESTORE',
  ORDER_IN: 'ORDER_IN',
  ORDER_OUT: 'ORDER_OUT',
} as const satisfies Record<StockMovementKind, StockMovementKind>;

export type ReorderItem = { id: string; order: number };

export type OrderItemInput = { itemId: string; quantity: number };

export type CraftIngredientInput = { usedItemId: string; quantity: number };

export type SaleItemInput = {
  itemId: string;
  quantity: number;
  source: SaleItemSource;
  chestId?: string | null;
};
