export function getEffectiveStockQuantity(
  stockToday: number | null | undefined,
  stockPrevious: number | null | undefined,
): number | null {
  if (stockToday !== null && stockToday !== undefined) return stockToday;
  if (stockPrevious !== null && stockPrevious !== undefined) return stockPrevious;
  return null;
}
