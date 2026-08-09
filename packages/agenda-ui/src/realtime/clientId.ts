import { getOrCreateRealtimeClientId } from '@lawless-intranet/realtime';

export function getOrCreateAgendaClientId(): string {
  return getOrCreateRealtimeClientId('dispensary');
}
