import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSession } from '@lawless-intranet/auth-client/server';
import type { AuthSession } from '@lawless-intranet/types';

/**
 * The media service is only called server-side by host apps (never by the
 * browser): every route requires the internal secret, plus the forwarded SSO
 * cookie to know who acts. Host apps check the "media" permission.
 */
export const MEDIA_INTERNAL_SECRET_HEADER = 'x-media-internal-secret';

export type AuthenticatedContext = {
  session: AuthSession;
  userId: string;
};

export function isMediaInternalAuthorized(request: Request): boolean {
  const secret = process.env.MEDIA_INTERNAL_SECRET;
  const provided = request.headers.get(MEDIA_INTERNAL_SECRET_HEADER);
  if (!secret || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
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

  const session = await getSession(request.headers.get('cookie'));
  if (!session) {
    return errorResponse('Unauthorized', 401);
  }
  return { session, userId: session.user.id };
}
