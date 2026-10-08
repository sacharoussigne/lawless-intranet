import { NextResponse } from 'next/server';
import { readSession, type AuthenticatedContext } from '@lawless-intranet/service-kit/http';
import { hasInternalSecret } from '@lawless-intranet/service-kit/internal-secret';

/**
 * The media service is only called server-side by host apps (never by the
 * browser): every route requires the internal secret, plus the forwarded SSO
 * cookie to know who acts. Host apps check the "media" permission.
 */
export const MEDIA_INTERNAL_SECRET_HEADER = 'x-media-internal-secret';

export type { AuthenticatedContext };

export function isMediaInternalAuthorized(request: Request): boolean {
  return hasInternalSecret(request, { env: 'MEDIA_INTERNAL_SECRET', header: MEDIA_INTERNAL_SECRET_HEADER });
}

export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export function errorResponse(error: string, status: number): NextResponse {
  return jsonResponse({ error }, status);
}

/** Internal secret only (host operations without a user, e.g. purge). */
export function requireInternal(request: Request): NextResponse | null {
  return isMediaInternalAuthorized(request) ? null : errorResponse('Forbidden', 403);
}

export async function requireSession(
  request: Request,
): Promise<AuthenticatedContext | NextResponse> {
  const forbidden = requireInternal(request);
  if (forbidden) return forbidden;

  return (await readSession(request)) ?? errorResponse('Unauthorized', 401);
}
