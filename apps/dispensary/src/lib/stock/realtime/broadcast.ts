import { after } from 'next/server';
import { parseRealtimeMutationMeta, REALTIME_DOMAIN, realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';
import { resolveDispensaryFromSlug } from '@/lib/dispensary/context';

/**
 * Tells the dispensary's stock viewers (topic checked in the realtime token)
 * that stock data changed: quantities, movements, crafts, items, recipes or
 * chests. A hint only, without any chest or item id: clients refetch through
 * their access-filtered reads. Published after the response, never awaited.
 */
export function emitStockChange(dispensaryId: string, meta?: { originClientId?: string }): void {
  after(() => publishStockChange(dispensaryId, meta?.originClientId));
}

function publishStockChange(dispensaryId: string, originClientId: string | undefined) {
  return publishRealtime(
    [realtimeTopics.stock(dispensaryId)],
    { domain: REALTIME_DOMAIN.stock, type: 'changed', originClientId, payload: {} },
    { logLabel: 'stock' },
  );
}

/**
 * Runs a server action that changes stock data and, when it succeeds, tells
 * the stock viewers. `meta` is the client's realtime meta (no echo to its author).
 */
export async function withStockChange<R extends { status: number }>(
  dispensarySlug: string,
  run: () => Promise<R>,
  meta?: unknown,
): Promise<R> {
  const result = await run();
  if (result.status < 400) {
    const origin = parseRealtimeMutationMeta(meta);
    after(async () => {
      const dispensary = await resolveDispensaryFromSlug(dispensarySlug);
      if (dispensary) await publishStockChange(dispensary.id, origin?.originClientId);
    });
  }
  return result;
}
