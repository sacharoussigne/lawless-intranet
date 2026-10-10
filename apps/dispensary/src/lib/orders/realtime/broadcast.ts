import { realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';
import { toOrdersRealtimeEnvelope } from '@/lib/orders/realtime/envelope';
import type { OrdersMutationMeta, OrdersRealtimeEvent } from '@/lib/orders/realtime/types';

/** Tells the dispensary's order viewers (topic checked in the realtime token) to refetch. */
export async function emitOrdersChange(
  dispensaryId: string,
  event: Omit<OrdersRealtimeEvent, 'originClientId' | 'type'> & {
    type?: 'orders';
  },
  meta?: OrdersMutationMeta,
): Promise<void> {
  await publishRealtime(
    [realtimeTopics.orders(dispensaryId)],
    toOrdersRealtimeEnvelope({
      type: 'orders',
      orderId: event.orderId,
      originClientId: meta?.originClientId,
    }),
    { logLabel: 'orders' },
  );
}
