function getBankUrl(): string {
  return process.env.BANK_URL ?? 'http://localhost:3004';
}

export const BANK_INTERNAL_SECRET_HEADER = 'x-bank-internal-secret';

function getCookieHeader(
  cookieHeader?: string | null,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  return { cookie: cookieHeader };
}

export class BankClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BankClientError';
    this.status = status;
  }
}

function getInternalHeaders(internal?: boolean): Record<string, string> {
  if (!internal) return {};
  const secret = process.env.BANK_INTERNAL_SECRET;
  if (!secret) {
    throw new BankClientError('BANK_INTERNAL_SECRET is not configured', 500);
  }
  return { [BANK_INTERNAL_SECRET_HEADER]: secret };
}

export type BankFetchOptions = RequestInit & {
  cookieHeader?: string | null;
  /** Host-only ops that require BANK_INTERNAL_SECRET */
  internal?: boolean;
};

async function bankFetch(
  path: string,
  init: BankFetchOptions = {},
): Promise<Response> {
  const { cookieHeader, internal, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);

  const cookie = getCookieHeader(cookieHeader);
  if (cookie.cookie) {
    headers.set('cookie', cookie.cookie);
  }

  for (const [key, value] of Object.entries(getInternalHeaders(internal))) {
    headers.set(key, value);
  }

  if (fetchInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${getBankUrl()}${path}`, {
    ...fetchInit,
    headers,
    cache: 'no-store',
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Bank API error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore
    }
    throw new BankClientError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export { getBankUrl, bankFetch, parseJsonResponse, toQuery };
