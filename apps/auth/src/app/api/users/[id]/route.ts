import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { corsPreflightResponse, withCors } from '@/lib/cors';
import { toAuthUser, toAuthUserPublic } from '@/lib/users';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireSession(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  const session = await requireSession(request);
  if (!session) {
    return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const { id } = await context.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      gender: true,
    },
  });

  if (!user) {
    return withCors(request, NextResponse.json({ error: 'Not found' }, { status: 404 }));
  }

  const authUser = await toAuthUser(user);
  return withCors(request, NextResponse.json(toAuthUserPublic(authUser)));
}
