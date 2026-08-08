import {
  broadcastWeeklySalesRealtime,
  weeklySalesRealtimeChannelKey,
} from '@/lib/sales/realtime/hub';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';

/**
 * Sales data now lives in the inventory service; PostgreSQL NOTIFY on the
 * dispensary DB is no longer available for cross-instance fan-out.
 * Keep in-process hub broadcast only until inventory emits sales events.
 */
export async function ensureWeeklySalesRealtimePgListener(): Promise<void> {
  // TODO: Wire sales realtime to inventory service events (pg_notify removed).
}

export async function publishWeeklySalesRealtime(
  dispensaryId: string,
  event: WeeklySalesRealtimeEvent,
): Promise<void> {
  broadcastWeeklySalesRealtime(weeklySalesRealtimeChannelKey(dispensaryId), event);
}
