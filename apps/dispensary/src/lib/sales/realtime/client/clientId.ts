import { getOrCreateRealtimeClientId } from '@lawless-intranet/realtime';

export function getOrCreateSalesClientId(): string {
  return getOrCreateRealtimeClientId('dispensary');
}
