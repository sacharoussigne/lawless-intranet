import { NextResponse } from 'next/server';
import { getSession } from '@lawless-intranet/auth-client/server';
import type { AuthSession } from '@lawless-intranet/types';
import { withCors } from '@/lib/cors';

export type AuthenticatedContext = {
  session: AuthSession;
  userId: string;
};

export async function requireSession(
  request: Request,
): Promise<AuthenticatedContext | NextResponse> {
  const cookieHeader = request.headers.get('cookie');
  const session = await getSession(cookieHeader);

  if (!session) {
    return withCors(
      request,
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
  }

  return {
    session,
    userId: session.user.id,
  };
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): NextResponse {
  return withCors(request, NextResponse.json(body, { status }));
}

export function errorResponse(
  request: Request,
  error: string,
  status: number,
): NextResponse {
  return jsonResponse(request, { error }, status);
}
