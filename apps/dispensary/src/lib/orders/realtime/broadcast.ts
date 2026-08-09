import {
  broadcastDispensaryRealtime,
  dispensaryRealtimeChannelKey,
} from '@/lib/realtime/hub';
import { toOrdersRealtimeEnvelope } from '@/lib/orders/realtime/envelope';
import type { OrdersMutationMeta, OrdersRealtimeEvent } from '@/lib/orders/realtime/types';

export async function emitOrdersChange(
  dispensaryId: string,
  event: Omit<OrdersRealtimeEvent, 'originClientId' | 'type'> & {
    type?: 'orders';
  },
  meta?: OrdersMutationMeta,
): Promise<void> {
  broadcastDispensaryRealtime(
    dispensaryRealtimeChannelKey(dispensaryId),
    toOrdersRealtimeEnvelope({
      type: 'orders',
      orderId: event.orderId,
      originClientId: meta?.originClientId,
    }),
  );
}
