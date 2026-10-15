import { after } from 'next/server';
import type { MediaScopeParams } from '@lawless-intranet/types';
import { REALTIME_DOMAIN, realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';

/**
 * Tells the clients of a scope that the library changed (refetch hint).
 * Called after the write; runs after the response is sent (`after`), never throws.
 */
export function notifyMediaChange(scope: MediaScopeParams): void {
  after(() =>
    publishRealtime(
      [realtimeTopics.media(scope.scopeType, scope.scopeId)],
      { domain: REALTIME_DOMAIN.media, type: 'changed', payload: {} },
      { logLabel: 'media-realtime' },
    ),
  );
}
