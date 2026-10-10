import { realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';
import { toWeeklySalesRealtimeEnvelope } from '@/lib/sales/realtime/envelope';
import type {
  SalesMutationMeta,
  WeeklySalesRealtimeEvent,
} from '@/lib/sales/realtime/types';

/** Tells every-sale viewers and the seller (topics checked in the realtime token) to refetch. */
export async function emitWeeklySalesChange(
  dispensaryId: string,
  event: Omit<WeeklySalesRealtimeEvent, 'originClientId' | 'type'> & {
    type?: 'weeklySales';
  },
  meta?: SalesMutationMeta,
): Promise<void> {
  await publishRealtime(
    [
      realtimeTopics.sales(dispensaryId),
      realtimeTopics.salesOfUser(dispensaryId, event.ownerUserId),
    ],
    toWeeklySalesRealtimeEnvelope({
      type: 'weeklySales',
      saleId: event.saleId,
      ownerUserId: event.ownerUserId,
      periodStart: event.periodStart,
      periodEnd: event.periodEnd,
      originClientId: meta?.originClientId,
    }),
    { logLabel: 'sales' },
  );
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
