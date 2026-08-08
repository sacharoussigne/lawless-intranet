export function slugifyOrderText(text: string, fallback = 'commande'): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function normalizeItemPrice(price: unknown): number | null {
  if (price == null) return null;
  if (typeof price === 'number') return Number.isFinite(price) ? price : null;
  const numPrice = Number(price);
  return Number.isFinite(numPrice) ? numPrice : null;
}

export function calculateOrderPriceFromItems(
  lines: { quantity: number; price: unknown }[],
): number | null {
  const total = lines.reduce((sum, line) => {
    const itemPrice = normalizeItemPrice(line.price);
    if (itemPrice != null && itemPrice > 0) {
      return sum + itemPrice * line.quantity;
    }
    return sum;
  }, 0);
  return total > 0 ? total : null;
}

export function getSaleEffectiveTotal(
  subtotal: number,
  priceAdjustment: number | null | undefined,
): number {
  return Math.max(0, subtotal + (priceAdjustment ?? 0));
}
