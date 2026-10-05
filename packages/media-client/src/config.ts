export function getMediaUrl(): string {
  return process.env.MEDIA_URL ?? 'http://localhost:3009';
}

export const MEDIA_INTERNAL_SECRET_HEADER = 'x-media-internal-secret';

export class MediaClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MediaClientError';
    this.status = status;
  }
}

function getInternalHeaders(): Record<string, string> {
  const secret = process.env.MEDIA_INTERNAL_SECRET;
  if (!secret) {
    throw new MediaClientError('MEDIA_INTERNAL_SECRET is not configured', 500);
  }
  return { [MEDIA_INTERNAL_SECRET_HEADER]: secret };
}

export type MediaFetchOptions = RequestInit & {
  /** Forwarded SSO cookie: the media service needs to know who acts. */
  cookieHeader?: string | null;
};

/** Server-side only: every call carries the internal secret. */
export async function mediaFetch(path: string, init: MediaFetchOptions = {}): Promise<Response> {
  const { cookieHeader, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);

  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  for (const [key, value] of Object.entries(getInternalHeaders())) {
    headers.set(key, value);
  }
  if (fetchInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    return await fetch(`${getMediaUrl()}${path}`, { ...fetchInit, headers, cache: 'no-store' });
  } catch {
    throw new MediaClientError('Service médiathèque injoignable', 503);
  }
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Media API error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the generic message.
    }
    throw new MediaClientError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function toQuery(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
