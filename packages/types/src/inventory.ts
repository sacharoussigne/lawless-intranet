export type InventoryScopeParams = {
  scopeType: string;
  scopeId: string;
};

export type StockMovementKind =
  | 'MANUAL_FIRST_COUNT'
  | 'MANUAL_ADJUST'
  | 'CRAFT_CONSUME'
  | 'CRAFT_PRODUCE'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'OVERWRITE'
  | 'TAKE_OUT'
  | 'DEPOSIT_IN'
  | 'SALE_OUT'
  | 'SALE_CANCEL_RESTORE'
  | 'ORDER_IN'
  | 'ORDER_OUT';

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export type SaleItemSource = 'POCKET' | 'CHEST';

export type OrderStatus =
  | 'DRAFT'
  | 'LETTER_SENT'
  | 'PROCESSING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type OrderType = 'INCOMING' | 'OUTGOING';

export type CategoryItemRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
};

export type ItemRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  description: string | null;
  minimalQuantity: number;
  isCraftable: boolean;
  isEnabled: boolean;
  canBeSold: boolean;
  price: number | null;
  weight: number | null;
  categoryId: string;
  companyGroupId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  category: Pick<CategoryItemRecord, 'id' | 'name' | 'color' | 'order'> | null;
  companyGroup: Pick<CompanyGroupRecord, 'id' | 'name'> | null;
};

export type ChestRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  stockHistoryCount?: number;
};

export type ChestLiteRecord = {
  id: string;
  name: string;
  order: number;
};

export type RoleChestAccessRecord = {
  role: string;
  allChests: boolean;
  chestIds: string[];
};

export type CompanyRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  bankAccountNumber: string | null;
  createdAt: string;
  updatedAt: string;
  companyGroups?: {
    companyGroupId: string;
    companyGroup: { id: string; name: string };
  }[];
  _count?: { companyGroups: number; orders: number };
};

export type CompanyGroupRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  companies?: {
    id?: string;
    companyId: string;
    company: { id: string; name: string };
  }[];
  _count?: { items: number };
};

export type CompanyGroupForOrdersRecord = {
  id: string;
  name: string;
  companies: { company: { id: string; name: string } }[];
};

export type IndividualCustomerRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CraftRecipeItemRecord = {
  id: string;
  craftRecipeId: string;
  usedItemId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  usedItem: Pick<ItemRecord, 'id' | 'name' | 'isEnabled'>;
};

export type CraftRecipeRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  description: string | null;
  craftedItemId: string;
  quantity: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  ingredients?: CraftRecipeItemRecord[];
};

export type OrderItemRecord = {
  id: string;
  orderId: string;
  itemId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  item?: Pick<ItemRecord, 'id' | 'name' | 'price' | 'weight' | 'isEnabled'>;
};

export type OrderRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  status: OrderStatus;
  type: OrderType;
  details: string | null;
  price: number | null;
  companyId: string | null;
  companyGroupId: string | null;
  individualCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string; bankAccountNumber?: string | null } | null;
  individualCustomer?: { id: string; name: string } | null;
  companyGroup?: { id: string; name: string } | null;
  items?: OrderItemRecord[];
  itemCount?: number;
  _count?: { items: number };
};

export type OrdersPageRecord = {
  orders: OrderRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type OrderMailAssignmentRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  templateId: string;
  createdAt: string;
  updatedAt: string;
};

export type SaleItemListRecord = {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number | null;
  source: SaleItemSource;
  chestId: string | null;
  chestName: string | null;
};

export type SaleListItemRecord = {
  id: string;
  userId: string;
  status: SaleStatus;
  createdAt: string;
  cancelledAt: string | null;
  depositedInCashRegister: boolean;
  depositedInCashRegisterAt: string | null;
  customerName: string | null;
  description: string | null;
  priceAdjustment: number;
  subtotalAmount: number;
  totalAmount: number;
  totalQuantity: number;
  items: SaleItemListRecord[];
};

export type SaleItemRecord = {
  id: string;
  saleId: string;
  itemId: string;
  quantity: number;
  unitPrice: number | null;
  source: SaleItemSource;
  chestId: string | null;
};

export type SaleRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  userId: string;
  status: SaleStatus;
  customerName: string | null;
  description: string | null;
  individualCustomerId: string | null;
  priceAdjustment: number;
  createdAt: string;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  depositedInCashRegister: boolean;
  depositedInCashRegisterAt: string | null;
  depositedByUserId: string | null;
  items?: SaleItemRecord[];
};

export type WeeklySalesRecord = {
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  totalQuantity: number;
  completedCount: number;
  cancelledCount: number;
  sales: SaleListItemRecord[];
  byUser: {
    userId: string;
    totalAmount: number;
    totalQuantity: number;
    completedCount: number;
  }[];
};

export type SellableItemRecord = {
  id: string;
  name: string;
  price: number | null;
  category: { id: string; name: string; color: string };
};

export type StockHistoryRecord = {
  id: string;
  itemId: string;
  chestId: string;
  quantity: number;
  timestamp: string;
};

export type StockMovementRecord = {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  chestId: string | null;
  chestName: string | null;
  destinationChestId: string | null;
  destinationChestName: string | null;
  quantity: number;
  kind: StockMovementKind;
  userId: string | null;
  note: string | null;
  createdAt: string;
};

export type StockMovementsPageRecord = {
  items: StockMovementRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type StockItemWithStockRecord = ItemRecord & {
  stockToday: number | null;
  stockYesterday: number | null;
  stockPreviousAt: string | null;
  stockForDate?: number | null;
  stockHistoryId?: string | null;
  stockByChest?: {
    chestId: string;
    chestName: string;
    stockToday: number | null;
    stockYesterday: number | null;
    stockPreviousAt: string | null;
  }[];
};

export type StockStatsItemRecord = {
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  consumed: number;
  added: number;
  net: number;
};

export type StockStatsRecord = {
  items: StockStatsItemRecord[];
  totals: { consumed: number; added: number; net: number };
};

export type ChestStockCheckConfigRecord = {
  chestId: string;
  isEnabled: boolean;
  categoryIds: string[];
};

export type ChestStockChecksRecord = {
  chests: Pick<ChestRecord, 'id' | 'name' | 'order' | 'isEnabled'>[];
  categories: Pick<CategoryItemRecord, 'id' | 'name' | 'color' | 'order'>[];
  configsByChestId: Record<string, ChestStockCheckConfigRecord>;
};

export type StockChecksSummaryRecord = {
  enabledChestIds: string[];
  configsByChestId: Record<string, ChestStockCheckConfigRecord>;
};

export type ChestStockVisibilityRecord = {
  hiddenCategoryIds: string[];
  hiddenItemIds: string[];
};

export type IdNameRecord = {
  id: string;
  name: string;
};
