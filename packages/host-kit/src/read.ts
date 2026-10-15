/**
 * Client-side reads over GET instead of server actions.
 *
 * Next runs server actions one at a time per tab, in the navigation queue, so
 * React Query refetches through them queue up. Each host exposes a closed
 * registry of its read actions behind one GET route
 * (`createReadRouteHandler`), and calls it with `createFetchRead`: same
 * `{ status, data?, error? }` result, requests in parallel. Auth, tenant and
 * permission checks stay in the actions. Same-origin only: no CORS on purpose.
 */

type ReadResultBase = { status: number };

/** Read action: `(slug, input) => ActionResponse` (`never` accepts any input type). */
export type ReadAction = (slug: string, input: never) => Promise<ReadResultBase>;
export type ReadRegistry = Record<string, ReadAction>;

const DATE_TAG = '$date';

/** JSON keeping `Date`s (server actions preserve them, plain JSON would not): `{ "$date": iso }`. */
export function encodeReadPayload(value: unknown): string {
  return JSON.stringify(value, function replacer(this: Record<string, unknown>, key, current: unknown) {
    // `current` is already `toJSON()`-ed; the original value is still on the holder.
    const raw = this[key];
    return raw instanceof Date ? { [DATE_TAG]: raw.toISOString() } : current;
  });
}

export function decodeReadPayload(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const tagged = (value as Record<string, unknown>)[DATE_TAG];
      if (Object.keys(value).length === 1 && typeof tagged === 'string') return new Date(tagged);
    }
    return value;
  });
}

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

/** GET handler for `app/api/<d|s>/[slug]/read/[query]/route.ts`; `?input=` is the action input. */
export function createReadRouteHandler(registry: ReadRegistry, slugParam: string) {
  return async function GET(
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ): Promise<Response> {
    const params = await context.params;
    const query = params.query ?? '';
    const slug = params[slugParam] ?? '';
    if (!Object.hasOwn(registry, query)) {
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

    const read = registry[query] as (slug: string, input: unknown) => Promise<ReadResultBase>;
    try {
      const result = await read(slug, input);
      return readResponse(result, result.status);
    } catch {
      // Malformed input reaching an action that does not validate it.
      return readResponse({ status: 400, error: 'Paramètres invalides' }, 400);
    }
  };
}

type ReadInput<R extends ReadRegistry, K extends keyof R> = Parameters<R[K]>[1];
type ReadResult<R extends ReadRegistry, K extends keyof R> = Awaited<ReturnType<R[K]>>;

/** Typed client for a host registry; `basePath(slug)` is e.g. `/api/d/<slug>/read`. */
export function createFetchRead<R extends ReadRegistry>(basePath: (slug: string) => string) {
  return async function fetchRead<K extends keyof R & string>(
    slug: string,
    query: K,
    ...[input]: ReadInput<R, K> extends undefined ? [input?: undefined] : [input: ReadInput<R, K>]
  ): Promise<ReadResult<R, K>> {
    const search = input === undefined ? '' : `?input=${encodeURIComponent(encodeReadPayload(input))}`;
    const response = await fetch(`${basePath(slug)}/${query}${search}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    try {
      return decodeReadPayload(await response.text()) as ReadResult<R, K>;
    } catch {
      return { status: response.status || 500, error: 'Réponse invalide du serveur' } as ReadResult<R, K>;
    }
  };
}
