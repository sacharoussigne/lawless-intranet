import type { ReadQuery, ReadRoutes } from '@/lib/read/readRoutes';
import { decodeReadPayload, encodeReadPayload } from '@/lib/read/transport';

type ReadInput<K extends ReadQuery> = Parameters<ReadRoutes[K]>[1];
type ReadResult<K extends ReadQuery> = Awaited<ReturnType<ReadRoutes[K]>>;

/**
 * GET counterpart of a read server action, for React Query `queryFn`s: same
 * result shape (`{ status, data?, error? }`, unwrap with `handleAction`), but
 * requests run in parallel instead of queuing behind other server actions.
 */
export async function fetchRead<K extends ReadQuery>(
  dispensarySlug: string,
  query: K,
  ...[input]: ReadInput<K> extends undefined ? [input?: undefined] : [input: ReadInput<K>]
): Promise<ReadResult<K>> {
  const search = input === undefined ? '' : `?input=${encodeURIComponent(encodeReadPayload(input))}`;
  const response = await fetch(
    `/api/d/${encodeURIComponent(dispensarySlug)}/read/${query}${search}`,
    { cache: 'no-store', credentials: 'same-origin' },
  );
  try {
    return decodeReadPayload(await response.text()) as ReadResult<K>;
  } catch {
    return { status: response.status || 500, error: 'Réponse invalide du serveur' } as ReadResult<K>;
  }
}
