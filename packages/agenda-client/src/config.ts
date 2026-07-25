function getAgendaUrl(): string {
  return process.env.AGENDA_URL ?? 'http://localhost:3003';
}

export const AGENDA_INTERNAL_SECRET_HEADER = 'x-agenda-internal-secret';

function getCookieHeader(
  cookieHeader?: string | null,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return { cookie: cookieHeader };
}

export class AgendaClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AgendaClientError';
    this.status = status;
    this.code = code;
  }
}

function getScopeAdminHeaders(scopeAdmin?: boolean): Record<string, string> {
  if (!scopeAdmin) {
    return {};
  }

  const secret = process.env.AGENDA_INTERNAL_SECRET;
  if (!secret) {
    throw new AgendaClientError(
      'AGENDA_INTERNAL_SECRET is not configured',
      500,
    );
  }

  return { [AGENDA_INTERNAL_SECRET_HEADER]: secret };
}

export type AgendaFetchOptions = RequestInit & {
  cookieHeader?: string | null;
  /** When true, sends the host-only internal secret (required for scopeAdmin ops). */
  scopeAdmin?: boolean;
};

async function agendaFetch(
  path: string,
  init: AgendaFetchOptions = {},
): Promise<Response> {
  const { cookieHeader, scopeAdmin, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);

  const cookie = getCookieHeader(cookieHeader);
  if (cookie.cookie) {
    headers.set('cookie', cookie.cookie);
  }

  for (const [key, value] of Object.entries(getScopeAdminHeaders(scopeAdmin))) {
    headers.set(key, value);
  }

  if (fetchInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${getAgendaUrl()}${path}`, {
    ...fetchInit,
    headers,
    cache: 'no-store',
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Agenda API error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new AgendaClientError(message, response.status);
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

export { getAgendaUrl, agendaFetch, parseJsonResponse, toQuery };
