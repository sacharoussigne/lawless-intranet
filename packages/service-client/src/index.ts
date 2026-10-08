/**
 * Shared fetch layer of the `*-client` packages: URL and internal secret from
 * env, forwarded SSO cookie, JSON parsing and typed errors.
 */

/** Base error of every service client; each package exports its own subclass. */
export class ServiceClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ServiceClientError';
    this.status = status;
    this.code = code;
  }
}

export type ServiceFetchOptions = RequestInit & {
  /** Forwarded SSO cookie of the end user. */
  cookieHeader?: string | null;
  /** Sends the internal secret (host-only operations). Ignored when `secret: 'always'`. */
  internal?: boolean;
};

export type ServiceFetchConfig = {
  /** Label used in generic error messages, e.g. `Bank` → "Bank API error (500)". */
  label: string;
  urlEnv: string;
  defaultUrl: string;
  secretEnv: string;
  secretHeader: string;
  /** `opt-in` (default): only when `internal: true`. `always`: on every call. */
  secret?: 'opt-in' | 'always';
  /** When set, a network failure becomes a 503 with this message instead of a raw fetch error. */
  unreachableMessage?: string;
  createError: (message: string, status: number) => ServiceClientError;
};

export function createServiceFetch(config: ServiceFetchConfig) {
  const { label, urlEnv, defaultUrl, secretEnv, secretHeader, unreachableMessage, createError } =
    config;
  const alwaysSendSecret = config.secret === 'always';

  function getUrl(): string {
    return process.env[urlEnv] ?? defaultUrl;
  }

  function internalSecret(): string {
    const secret = process.env[secretEnv];
    if (!secret) {
      throw createError(`${secretEnv} is not configured`, 500);
    }
    return secret;
  }

  async function serviceFetch(path: string, init: ServiceFetchOptions = {}): Promise<Response> {
    const { cookieHeader, internal, ...fetchInit } = init;
    const headers = new Headers(fetchInit.headers);

    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }
    if (alwaysSendSecret || internal) {
      headers.set(secretHeader, internalSecret());
    }
    if (fetchInit.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const send = () => fetch(`${getUrl()}${path}`, { ...fetchInit, headers, cache: 'no-store' });
    if (!unreachableMessage) {
      return send();
    }
    try {
      return await send();
    } catch {
      throw createError(unreachableMessage, 503);
    }
  }

  async function parseJsonResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let message = `${label} API error (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) {
          message = body.error;
        }
      } catch {
        // Keep the generic message.
      }
      throw createError(message, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return { getUrl, fetch: serviceFetch, parseJsonResponse };
}

type QueryValue = string | number | boolean | null | undefined;

/** `?a=1&b=2`, skipping null/undefined; arrays are repeated (`?id=a&id=b`). */
export function toQuery(params: Record<string, QueryValue | string[]>): string {
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
