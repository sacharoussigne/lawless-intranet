/**
 * Short in-process cache for session lookups. Every server action, route and
 * service request checks the session against the auth service: within a few
 * seconds the answer is the same, so it is reused (and concurrent lookups for
 * the same cookie share one request).
 *
 * Trade-off: a sign-out or ban elsewhere takes up to `ttlMs` to apply. Only
 * valid sessions are cached; an unknown or expired session always asks again.
 */

/** Better Auth session cookie (`advanced.cookiePrefix` in apps/auth), `__Secure-` prefixed over HTTPS. */
const SESSION_COOKIE_PATTERN = /(?:^|;\s*)(?:__Secure-)?lawless-intranet\.session_token=([^;]+)/;

export function readSessionCookieKey(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  return SESSION_COOKIE_PATTERN.exec(cookieHeader)?.[1] ?? null;
}

type Entry<T> = { value: T; expiresAt: number };

export function createSessionCache<T>(options: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry<T>>();
  const inFlight = new Map<string, Promise<T | null>>();

  const prune = (time: number) => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= time) entries.delete(key);
    }
    // Map keeps insertion order: drop the oldest first.
    while (entries.size >= options.maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };

  return {
    async get(key: string, load: () => Promise<T | null>): Promise<T | null> {
      const time = now();
      const cached = entries.get(key);
      if (cached && cached.expiresAt > time) return cached.value;

      const pending = inFlight.get(key);
      if (pending) return pending;

      const request = load()
        .then((value) => {
          if (value !== null) {
            prune(now());
            entries.set(key, { value, expiresAt: now() + options.ttlMs });
          } else {
            entries.delete(key);
          }
          return value;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, request);
      return request;
    },
    clear() {
      entries.clear();
      inFlight.clear();
    },
  };
}
