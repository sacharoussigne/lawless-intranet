import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { corsPreflightResponse, withCors } from '@/lib/cors';
import { toAuthUser } from '@/lib/users';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return withCors(request, NextResponse.json(null, { status: 401 }));
  }

  const user = await toAuthUser(session.user);

  return withCors(
    request,
    NextResponse.json({
      session: {
        id: session.session.id,
        expiresAt: session.session.expiresAt.toISOString(),
        impersonatedBy: session.session.impersonatedBy ?? null,
      },
      user,
    }),
  );
}
