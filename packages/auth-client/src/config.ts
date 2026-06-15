function getAuthUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_AUTH_URL ??
    'http://localhost:3001'
  );
}

export function getCookieHeader(
  cookieHeader?: string | null,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return { cookie: cookieHeader };
}

async function authFetch(
  path: string,
  init: RequestInit & { cookieHeader?: string | null } = {},
): Promise<Response> {
  const { cookieHeader, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);

  const cookie = getCookieHeader(cookieHeader);
  if (cookie.cookie) {
    headers.set('cookie', cookie.cookie);
  }

  return fetch(`${getAuthUrl()}${path}`, {
    ...fetchInit,
    headers,
    cache: 'no-store',
  });
}

export { getAuthUrl, authFetch };
