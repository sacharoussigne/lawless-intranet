import type { MediaScopeParams } from '@lawless-intranet/types';
import { REALTIME_DOMAIN, realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';

/**
 * Tells the clients of a scope that the library changed (refetch hint).
 * Called after the write; never throws (see publishRealtime).
 */
export async function notifyMediaChange(scope: MediaScopeParams): Promise<void> {
  await publishRealtime(
    [realtimeTopics.media(scope.scopeType, scope.scopeId)],
    { domain: REALTIME_DOMAIN.media, type: 'changed', payload: {} },
    { logLabel: 'media-realtime' },
  );
}
