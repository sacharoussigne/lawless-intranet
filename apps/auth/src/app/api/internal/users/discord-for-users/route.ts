import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DISCORD_PROVIDER_ID } from '@/lib/constants';
import { isInternalAuthAuthorized } from '@/lib/internalAuth';

export async function POST(request: Request) {
  if (!isInternalAuthAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { userIds?: string[] };
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];

  if (userIds.length === 0) {
    return NextResponse.json([]);
  }

  const accounts = await prisma.account.findMany({
    where: {
      providerId: DISCORD_PROVIDER_ID,
      userId: { in: userIds },
    },
    select: {
      accountId: true,
      userId: true,
    },
  });

  return NextResponse.json(
    accounts.map((account) => ({
      discordId: account.accountId,
      userId: account.userId,
    })),
  );
}
