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

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return withCors(request, NextResponse.json([]));
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
    take: 20,
    orderBy: { name: 'asc' },
  });

  const authUsers = await toAuthUsers(users);

  return withCors(
    request,
    NextResponse.json(authUsers.map((user) => toAuthUserPublic(user))),
  );
}
