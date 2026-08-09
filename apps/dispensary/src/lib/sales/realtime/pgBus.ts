import {
  broadcastWeeklySalesRealtime,
  weeklySalesRealtimeChannelKey,
} from '@/lib/sales/realtime/hub';
import type { WeeklySalesRealtimeEvent } from '@/lib/sales/realtime/types';

/**
 * Sales live in the inventory service. Local broadcast remains for
 * same-process emits; cross-service fan-out uses /api/internal/realtime/publish.
 */
export async function ensureWeeklySalesRealtimePgListener(): Promise<void> {
  // No-op: inventory publishes into the dispensary multiplex hub.
}

export async function publishWeeklySalesRealtime(
  dispensaryId: string,
  event: WeeklySalesRealtimeEvent,
): Promise<void> {
  broadcastWeeklySalesRealtime(weeklySalesRealtimeChannelKey(dispensaryId), event);
}
