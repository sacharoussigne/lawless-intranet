export function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function serializeItem<T extends { price?: unknown; createdAt?: Date; updatedAt?: Date }>(
  item: T,
) {
  return {
    ...item,
    price: decimalToNumber(item.price),
    createdAt: toIso(item.createdAt as Date | undefined) ?? item.createdAt,
    updatedAt: toIso(item.updatedAt as Date | undefined) ?? item.updatedAt,
  };
}

export function serializeOrder<
  T extends {
    price?: unknown;
    createdAt?: Date;
    updatedAt?: Date;
    items?: Array<{ item?: { price?: unknown } & Record<string, unknown> } & Record<string, unknown>>;
  },
>(order: T) {
  return {
    ...order,
    price: decimalToNumber(order.price),
    createdAt: toIso(order.createdAt as Date | undefined) ?? order.createdAt,
    updatedAt: toIso(order.updatedAt as Date | undefined) ?? order.updatedAt,
    items: order.items?.map((orderItem) => ({
      ...orderItem,
      item: orderItem.item
        ? {
            ...orderItem.item,
            price: decimalToNumber(orderItem.item.price),
          }
        : orderItem.item,
    })),
  };
}
