import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { corsPreflightResponse, withCors } from '@/lib/cors';
import { toAuthUsers, toAuthUserPublic } from '@/lib/users';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  });

  const authUsers = await toAuthUsers(users);
  return withCors(
    request,
    NextResponse.json(authUsers.map((user) => toAuthUserPublic(user))),
  );
}
