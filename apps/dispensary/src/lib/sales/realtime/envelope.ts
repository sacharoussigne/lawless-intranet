import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';

export type WeeklySalesRealtimePayload = Omit<
  WeeklySalesRealtimeEvent,
  'type' | 'originClientId'
>;

export function toWeeklySalesRealtimeEnvelope(
  event: WeeklySalesRealtimeEvent,
): RealtimeEnvelope<WeeklySalesRealtimePayload> {
  return {
    domain: REALTIME_DOMAIN.sales,
    type: event.type,
    originClientId: event.originClientId,
    payload: {
      saleId: event.saleId,
      ownerUserId: event.ownerUserId,
      periodStart: event.periodStart,
      periodEnd: event.periodEnd,
    },
  };
}

export function fromWeeklySalesRealtimeEnvelope(
  envelope: RealtimeEnvelope,
): WeeklySalesRealtimeEvent {
  const payload = envelope.payload as WeeklySalesRealtimePayload;
  return {
    type: 'weeklySales',
    saleId: payload.saleId,
    ownerUserId: payload.ownerUserId,
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    originClientId: envelope.originClientId,
  };
}
