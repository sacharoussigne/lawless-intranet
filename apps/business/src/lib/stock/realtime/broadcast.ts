import { after } from 'next/server';
import { parseRealtimeMutationMeta, REALTIME_DOMAIN, realtimeTopics } from '@lawless-intranet/realtime';
import { publishRealtime } from '@lawless-intranet/realtime/publish';
import { resolveBusinessFromSlug } from '@/lib/business/context';

/**
 * Tells the dispensary's stock viewers (topic checked in the realtime token)
 * that stock data changed: quantities, movements, crafts, items, recipes or
 * chests. A hint only, without any chest or item id: clients refetch through
 * their access-filtered reads. Published after the response, never awaited.
 */
export function emitStockChange(businessId: string, meta?: { originClientId?: string }): void {
  after(() => publishStockChange(businessId, meta?.originClientId));
}

function publishStockChange(businessId: string, originClientId: string | undefined) {
  return publishRealtime(
    [realtimeTopics.stock(businessId)],
    { domain: REALTIME_DOMAIN.stock, type: 'changed', originClientId, payload: {} },
    { logLabel: 'stock' },
  );
}

/**
 * Runs a server action that changes stock data and, when it succeeds, tells
 * the stock viewers. `meta` is the client's realtime meta (no echo to its author).
 */
export async function withStockChange<R extends { status: number }>(
  businessSlug: string,
  run: () => Promise<R>,
  meta?: unknown,
): Promise<R> {
  const result = await run();
  if (result.status < 400) {
    const origin = parseRealtimeMutationMeta(meta);
    after(async () => {
      const business = await resolveBusinessFromSlug(businessSlug);
      if (business) await publishStockChange(business.id, origin?.originClientId);
    });
  }
  return result;
}
