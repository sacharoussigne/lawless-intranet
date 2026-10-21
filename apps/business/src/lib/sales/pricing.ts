export function getSaleEffectiveTotal(
  subtotal: number,
  priceAdjustment: number | null | undefined,
): number {
  return Math.max(0, subtotal + (priceAdjustment ?? 0));
}
