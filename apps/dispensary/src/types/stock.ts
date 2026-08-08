import type {
  StockItemWithStockRecord,
  StockMovementRecord,
  StockMovementsPageRecord,
} from '@lawless-intranet/types';

export type ItemWithRelations = StockItemWithStockRecord;

export interface CategoryWithItems {
  category: { id: string; name: string; color: string; order?: number };
  items: ItemWithRelations[];
}

export type ItemWithDetailedStock = StockItemWithStockRecord;

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
  kind: StockMovementRecord['kind'];
  userId: string | null;
  userName: string | null;
  note: string | null;
  createdAt: Date | string;
};

export type StockMovementsPageResult = Omit<StockMovementsPageRecord, 'items'> & {
  items: StockMovementListItem[];
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
