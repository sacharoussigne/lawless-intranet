import type { OrderStatus } from '@lawless-intranet/types';

/** Path of an order, in order; CANCELLED stands aside. */
export const ORDER_STATUS_STEPS = [
  'DRAFT',
  'LETTER_SENT',
  'PROCESSING',
  'READY',
  'COMPLETED',
] as const satisfies readonly OrderStatus[];

/** Position on the path (-1 for a cancelled order). */
export function orderStatusStepIndex(status: OrderStatus): number {
  return (ORDER_STATUS_STEPS as readonly OrderStatus[]).indexOf(status);
}

/** Next status on the path, or null at the end or when cancelled. */
export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  const index = orderStatusStepIndex(status);
  if (index < 0 || index >= ORDER_STATUS_STEPS.length - 1) return null;
  return ORDER_STATUS_STEPS[index + 1];
}
