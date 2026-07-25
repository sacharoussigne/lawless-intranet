function getDocumentsUrl(): string {
  return process.env.DOCUMENTS_URL ?? 'http://localhost:3002';
}

export const DOCUMENTS_INTERNAL_SECRET_HEADER = 'x-documents-internal-secret';

function getCookieHeader(
  cookieHeader?: string | null,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return { cookie: cookieHeader };
}

export class DocumentsClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'DocumentsClientError';
    this.status = status;
    this.code = code;
  }
}

function getInternalHeaders(): Record<string, string> {
  const secret = process.env.DOCUMENTS_INTERNAL_SECRET;
  if (!secret) {
    throw new DocumentsClientError(
      'DOCUMENTS_INTERNAL_SECRET is not configured',
      500,
    );
  }

  return { [DOCUMENTS_INTERNAL_SECRET_HEADER]: secret };
}

export type DocumentsFetchOptions = RequestInit & {
  cookieHeader?: string | null;
};

async function documentsFetch(
  path: string,
  init: DocumentsFetchOptions = {},
): Promise<Response> {
  const { cookieHeader, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);

  const cookie = getCookieHeader(cookieHeader);
  if (cookie.cookie) {
    headers.set('cookie', cookie.cookie);
  }

  for (const [key, value] of Object.entries(getInternalHeaders())) {
    headers.set(key, value);
  }

  if (fetchInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${getDocumentsUrl()}${path}`, {
    ...fetchInit,
    headers,
    cache: 'no-store',
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Documents API error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new DocumentsClientError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export { getDocumentsUrl, documentsFetch, parseJsonResponse };
