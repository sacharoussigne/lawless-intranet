import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DISCORD_PROVIDER_ID } from '@/lib/constants';
import { corsPreflightResponse, withCors } from '@/lib/cors';
import { toAuthUsers, toAuthUserPublic } from '@/lib/users';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];

  if (ids.length === 0) {
    return withCors(request, NextResponse.json([]));
  }

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  });

  const authUsers = await toAuthUsers(users);
  return withCors(
    request,
    NextResponse.json(authUsers.map((user) => toAuthUserPublic(user))),
  );
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return withCors(request, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const { searchParams } = new URL(request.url);
  const discordOnly = searchParams.get('discordOnly') === 'true';

  const users = await prisma.user.findMany({
    where: discordOnly
      ? {
          accounts: {
            some: { providerId: DISCORD_PROVIDER_ID },
          },
        }
      : undefined,
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
