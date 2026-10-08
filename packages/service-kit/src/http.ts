import { NextResponse } from 'next/server';
import { getSession } from '@lawless-intranet/auth-client/server';
import type { AuthSession } from '@lawless-intranet/types';

export type AuthenticatedContext = {
  session: AuthSession;
  userId: string;
};

export type CorsConfig = {
  getTrustedOrigins: () => string[];
  /** Default `Access-Control-Allow-Headers` when the preflight does not request any. */
  allowHeaders?: string;
};

/** CORS for services called from the browser with the SSO cookie. */
export function createCors({
  getTrustedOrigins,
  allowHeaders = 'Content-Type, Authorization, Cookie',
}: CorsConfig) {
  function withCors(request: Request, response: NextResponse): NextResponse {
    const origin = request.headers.get('origin');
    if (origin && getTrustedOrigins().includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    }
    return response;
  }

  function corsPreflightResponse(request: Request): NextResponse {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      request.headers.get('Access-Control-Request-Headers') ?? allowHeaders,
    );
    return withCors(request, response);
  }

  return { withCors, corsPreflightResponse };
}

/** Session of the forwarded SSO cookie, or null. */
export async function readSession(request: Request): Promise<AuthenticatedContext | null> {
  const session = await getSession(request.headers.get('cookie'));
  return session ? { session, userId: session.user.id } : null;
}

export type RouteResponsesConfig = {
  withCors: (request: Request, response: NextResponse) => NextResponse;
  /** When set, `requireSession` first rejects callers without the internal secret (403). */
  isInternalAuthorized?: (request: Request) => boolean;
};

/** `requireSession` / `jsonResponse` / `errorResponse` of route handlers, with CORS applied. */
export function createRouteResponses({ withCors, isInternalAuthorized }: RouteResponsesConfig) {
  function jsonResponse(request: Request, body: unknown, status = 200): NextResponse {
    return withCors(request, NextResponse.json(body, { status }));
  }

  function errorResponse(request: Request, error: string, status: number): NextResponse {
    return jsonResponse(request, { error }, status);
  }

  async function requireSession(request: Request): Promise<AuthenticatedContext | NextResponse> {
    if (isInternalAuthorized && !isInternalAuthorized(request)) {
      return errorResponse(request, 'Forbidden', 403);
    }
    return (await readSession(request)) ?? errorResponse(request, 'Unauthorized', 401);
  }

  return { requireSession, jsonResponse, errorResponse };
}
