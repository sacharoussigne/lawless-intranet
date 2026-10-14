import { isReadQuery, readRoutes } from '@/lib/read/readRoutes';
import { decodeReadPayload, encodeReadPayload } from '@/lib/read/transport';

export const dynamic = 'force-dynamic';

function readResponse(body: unknown, status: number) {
  return new Response(encodeReadPayload(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Per-user data; realtime invalidates React Query instead.
      'Cache-Control': 'private, no-store',
    },
  });
}

/** Client-side reads (see lib/read/readRoutes): same-origin only, no CORS on purpose. */
export async function GET(
  request: Request,
  context: { params: Promise<{ dispensarySlug: string; query: string }> },
) {
  const { dispensarySlug, query } = await context.params;
  if (!isReadQuery(query)) {
    return readResponse({ status: 404, error: 'Lecture inconnue' }, 404);
  }

  let input: unknown;
  const rawInput = new URL(request.url).searchParams.get('input');
  if (rawInput !== null) {
    try {
      input = decodeReadPayload(rawInput);
    } catch {
      return readResponse({ status: 400, error: 'Paramètres invalides' }, 400);
    }
  }

  const read = readRoutes[query] as (slug: string, input: unknown) => Promise<{ status: number }>;
  try {
    const result = await read(dispensarySlug, input);
    return readResponse(result, result.status);
  } catch {
    // Malformed input reaching an action that does not validate it.
    return readResponse({ status: 400, error: 'Paramètres invalides' }, 400);
  }
}
