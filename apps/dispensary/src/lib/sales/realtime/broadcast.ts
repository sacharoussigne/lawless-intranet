import { publishWeeklySalesRealtime } from '@/lib/sales/realtime/pgBus';
import type {
  SalesMutationMeta,
  WeeklySalesRealtimeEvent,
} from '@/lib/sales/realtime/types';

export async function emitWeeklySalesChange(
  dispensaryId: string,
  event: Omit<WeeklySalesRealtimeEvent, 'originClientId' | 'type'> & {
    type?: 'weeklySales';
  },
  meta?: SalesMutationMeta,
): Promise<void> {
  await publishWeeklySalesRealtime(dispensaryId, {
    type: 'weeklySales',
    saleId: event.saleId,
    ownerUserId: event.ownerUserId,
    periodStart: event.periodStart,
    periodEnd: event.periodEnd,
    originClientId: meta?.originClientId,
  });
}

export function saleToWeeklySalesRealtimePayload(
  sale: {
    id: string;
    userId: string;
    periodStart: Date;
    periodEnd: Date;
  },
): Omit<WeeklySalesRealtimeEvent, 'originClientId' | 'type'> {
  return {
    saleId: sale.id,
    ownerUserId: sale.userId,
    periodStart: sale.periodStart.toISOString(),
    periodEnd: sale.periodEnd.toISOString(),
  };
}
