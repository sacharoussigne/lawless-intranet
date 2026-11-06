import { after } from 'next/server';
import { parseRealtimeMutationMeta, REALTIME_DOMAIN, realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';

/**
 * Tells the members of a letter box (topic checked in the realtime token) that
 * something changed in it. A hint only: clients refetch through their guarded
 * reads. Published after the response, never awaited.
 */
export function emitLetterBoxChanged(boxId: string, meta?: unknown): void {
  const originClientId = parseRealtimeMutationMeta(meta)?.originClientId;
  after(() =>
    publishRealtime(
      [realtimeTopics.letterBox(boxId)],
      { domain: REALTIME_DOMAIN.letters, type: 'changed', originClientId, payload: { boxId } },
      { logLabel: 'letters' },
    ),
  );
}
