import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import type { OrdersRealtimeEvent } from '@/lib/orders/realtime/types';

export type OrdersRealtimePayload = {
  orderId: string;
};

export function toOrdersRealtimeEnvelope(
  event: OrdersRealtimeEvent,
): RealtimeEnvelope<OrdersRealtimePayload> {
  return {
    domain: REALTIME_DOMAIN.orders,
    type: event.type,
    originClientId: event.originClientId,
    payload: {
      orderId: event.orderId,
    },
  };
}

export function fromOrdersRealtimeEnvelope(
  envelope: RealtimeEnvelope,
): OrdersRealtimeEvent {
  const payload = envelope.payload as OrdersRealtimePayload;
  return {
    type: 'orders',
    orderId: payload.orderId,
    originClientId: envelope.originClientId,
  };
}
