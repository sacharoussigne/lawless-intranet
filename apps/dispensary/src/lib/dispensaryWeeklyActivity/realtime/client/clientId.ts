import { getOrCreateRealtimeClientId } from '@lawless-intranet/realtime';

export function getOrCreateWeeklyActivityClientId(): string {
  return getOrCreateRealtimeClientId('dispensary');
}
