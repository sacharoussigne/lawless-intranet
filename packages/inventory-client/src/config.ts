function getInventoryUrl(): string {
  return process.env.INVENTORY_URL ?? 'http://localhost:3005';
}

export const INVENTORY_INTERNAL_SECRET_HEADER = 'x-inventory-internal-secret';

function getCookieHeader(
  cookieHeader?: string | null,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  return { cookie: cookieHeader };
}

export class InventoryClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'InventoryClientError';
    this.status = status;
  }
}

function getInternalHeaders(internal?: boolean): Record<string, string> {
  if (!internal) return {};
  const secret = process.env.INVENTORY_INTERNAL_SECRET;
  if (!secret) {
    throw new InventoryClientError('INVENTORY_INTERNAL_SECRET is not configured', 500);
  }
  return { [INVENTORY_INTERNAL_SECRET_HEADER]: secret };
}

export type InventoryFetchOptions = RequestInit & {
  cookieHeader?: string | null;
  /** Host-only ops that require INVENTORY_INTERNAL_SECRET */
  internal?: boolean;
};

async function inventoryFetch(
  path: string,
  init: InventoryFetchOptions = {},
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

  return fetch(`${getInventoryUrl()}${path}`, {
    ...fetchInit,
    headers,
    cache: 'no-store',
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Inventory API error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore
    }
    throw new InventoryClientError(message, response.status);
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

function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function toQueryWithArray(
  params: Record<string, string | number | boolean | undefined | null | string[]>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        search.append(key, entry);
      }
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export {
  getInventoryUrl,
  inventoryFetch,
  parseJsonResponse,
  toQuery,
  toQueryWithArray,
};
