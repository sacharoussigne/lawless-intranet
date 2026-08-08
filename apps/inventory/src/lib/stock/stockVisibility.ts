export type ChestStockVisibility = {
  hiddenCategoryIds: string[];
  hiddenItemIds: string[];
};

export const EMPTY_CHEST_STOCK_VISIBILITY: ChestStockVisibility = {
  hiddenCategoryIds: [],
  hiddenItemIds: [],
};
