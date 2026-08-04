export interface ItemWithRelations {
  id: string;
  name: string;
  description: string | null;
  minimalQuantity: number;
  isCraftable: boolean;
  isEnabled?: boolean;
  canBeSold?: boolean;
  price?: number | string | null;
  weight?: number | null;
  categoryId: string;
  companyGroupId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; color: string; order?: number } | null;
  companyGroup: { id: string; name: string } | null;
  stockToday: number | null;
  stockYesterday: number | null;
  stockPreviousAt: Date | null;
}

export interface CategoryWithItems {
  category: { id: string; name: string; color: string; order?: number };
  items: ItemWithRelations[];
}

export type StockMovementChestFilter = 'all' | 'global' | string;

export type StockMovementsPageFilters = {
  page: number;
  pageSize: number;
  itemSearch?: string;
  itemId?: string;
  chestFilter?: StockMovementChestFilter;
  kind?: string;
  from?: string;
  to?: string;
};

export type StockMovementListItem = {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  chestId: string | null;
  chestName: string | null;
  destinationChestId: string | null;
  destinationChestName: string | null;
  quantity: number;
  kind: string;
  userId: string | null;
  userName: string | null;
  note: string | null;
  createdAt: Date;
};

export type StockMovementsPageResult = {
  items: StockMovementListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type StockMovementReconciliationResult = {
  itemId: string;
  itemName: string;
  chestFilter: StockMovementChestFilter;
  chestName: string | null;
  from: Date;
  to: Date;
  stockAtPeriodStart: number | null;
  stockAtPeriodEnd: number | null;
  stockDelta: number;
  movementsSum: number;
  gap: number;
  hasGap: boolean;
  movementsWithoutChest: number;
  stockReconciliationAvailable: boolean;
};

