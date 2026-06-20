export type OrderMailPreviewSource = {
  type: string;
  status: string;
  price: unknown;
  company: { name: string } | null;
  individualCustomer: { name: string } | null;
  items: Array<{
    quantity: number;
    item: { name: string };
  }>;
};

export function buildOrderMailVariables(
  order: OrderMailPreviewSource
): Record<string, string> {
  const itemsText = order.items
    .map((orderItem) => {
      const itemName = orderItem.item.name;
      const quantity = orderItem.quantity;
      return `- ${itemName} (x${quantity})`;
    })
    .join('\n');

  const priceValue = order.price != null ? Number(order.price) : null;
  const priceText =
    priceValue != null && Number.isFinite(priceValue)
      ? `${priceValue.toFixed(2)} $`
      : 'Non spécifié';

  const clientName =
    order.individualCustomer?.name ?? order.company?.name ?? 'Client';

  return {
    name: clientName,
    items: itemsText,
    price: priceText,
  };
}
