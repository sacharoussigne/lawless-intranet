import type { OrderEventChange, OrderEventItemLine } from '@lawless-intranet/types';
import type { OrderStatus, OrderType } from '@/generated/prisma/client';

/** What the chatter compares between two versions of an order. */
export type OrderSnapshot = {
  name: string;
  status: OrderStatus;
  type: OrderType;
  details: string | null;
  price: number | null;
  priceManual: boolean;
  responsibleUserId: string | null;
  items: OrderEventItemLine[];
};

function diffItems(before: OrderEventItemLine[], after: OrderEventItemLine[]) {
  const beforeById = new Map(before.map((line) => [line.itemId, line]));
  const afterById = new Map(after.map((line) => [line.itemId, line]));
  const added = after.filter((line) => !beforeById.has(line.itemId));
  const removed = before.filter((line) => !afterById.has(line.itemId));
  const changed = after.flatMap((line) => {
    const previous = beforeById.get(line.itemId);
    return previous && previous.quantity !== line.quantity
      ? [{ itemId: line.itemId, name: line.name, from: previous.quantity, to: line.quantity }]
      : [];
  });
  return { added, removed, changed };
}

/** Changes between two versions of an order, in display order (empty when nothing changed). */
export function diffOrderSnapshots(before: OrderSnapshot, after: OrderSnapshot): OrderEventChange[] {
  const changes: OrderEventChange[] = [];
  if (before.status !== after.status) {
    changes.push({ field: 'status', from: before.status, to: after.status });
  }
  if (before.type !== after.type) {
    changes.push({ field: 'type', from: before.type, to: after.type });
  }
  if (before.name !== after.name) {
    changes.push({ field: 'name', from: before.name, to: after.name });
  }
  if ((before.details ?? null) !== (after.details ?? null)) {
    changes.push({ field: 'details', from: before.details ?? null, to: after.details ?? null });
  }
  if (before.responsibleUserId !== after.responsibleUserId) {
    changes.push({ field: 'responsible', from: before.responsibleUserId, to: after.responsibleUserId });
  }
  const items = diffItems(before.items, after.items);
  if (items.added.length > 0 || items.removed.length > 0 || items.changed.length > 0) {
    changes.push({ field: 'items', ...items });
  }
  if (before.price !== after.price || before.priceManual !== after.priceManual) {
    changes.push({ field: 'price', from: before.price, to: after.price, manual: after.priceManual });
  }
  return changes;
}

/**
 * Price and mode an order ends up with. A hand-typed price sticks until the mode goes
 * back to automatic; an automatic price is always the catalog total of the items.
 */
export function resolvePriceMode(input: {
  requestedManual: boolean | undefined;
  requestedPrice: number | null | undefined;
  currentManual: boolean;
  currentPrice: number | null;
  catalogTotal: number | null;
}): { price: number | null; priceManual: boolean } {
  const manual = input.requestedManual ?? input.currentManual;
  if (manual) {
    const price = input.requestedPrice !== undefined ? input.requestedPrice : input.currentPrice;
    if (price != null) return { price, priceManual: true };
  }
  return { price: input.catalogTotal, priceManual: false };
}
