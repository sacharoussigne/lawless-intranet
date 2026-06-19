function getAuthUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_AUTH_URL ??
    'http://localhost:3001'
  );
}

export type AuthRequestContext =
  | string
  | null
  | {
      cookieHeader?: string | null;
      origin?: string | null;
    };

function getDefaultOrigin(): string {
  return (
    process.env.DISPENSARY_URL ??
    process.env.NEXT_PUBLIC_DISPENSARY_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  );
}

export function normalizeAuthRequestContext(
  context?: AuthRequestContext,
): { cookieHeader?: string | null; origin?: string | null } {
  if (context == null || typeof context === 'string') {
    return { cookieHeader: context ?? null };
  }

  return context;
}

export function buildOriginFromHeaders(headers: Headers): string | null {
  const origin = headers.get('origin');
  if (origin) {
    return origin;
  }

  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) {
    return null;
  }

  const proto = headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host.split(',')[0]?.trim()}`;
}

export function getCookieHeader(
  cookieHeader?: string | null,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return { cookie: cookieHeader };
}

type AuthFetchOptions = RequestInit & {
  cookieHeader?: string | null;
  origin?: string | null;
};

async function authFetch(
  path: string,
  init: AuthFetchOptions = {},
): Promise<Response> {
  const { cookieHeader, origin, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);

  const cookie = getCookieHeader(cookieHeader);
  if (cookie.cookie) {
    headers.set('cookie', cookie.cookie);
  }

  const method = (fetchInit.method ?? 'GET').toUpperCase();
  if (!headers.has('Origin') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Origin', origin ?? getDefaultOrigin());
  }

  return fetch(`${getAuthUrl()}${path}`, {
    ...fetchInit,
    headers,
    cache: 'no-store',
  });
}

export { getAuthUrl, authFetch, getDefaultOrigin };
