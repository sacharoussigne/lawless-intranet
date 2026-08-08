import { NextResponse } from 'next/server';
import {
  isDispensaryBotApiAuthorized,
  getDispensaryIdFromBotRequest,
} from '@/lib/dispensaryWeeklyActivityApiAuth';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import prisma from '@/lib/prisma';
import { getBankUrl } from '@lawless-intranet/bank-client';

function jsonError(status: number, error: string) {
  return NextResponse.json({ status, error }, { status });
}

/**
 * Proxy to bank service materialize-planned.
 * Auth: Bearer DISPENSARY_BOT_API_SECRET + X-Dispensary-Id
 * Optional query: ?date=YYYY-MM-DD
 */
export async function POST(request: Request) {
  const req = request as Parameters<typeof isDispensaryBotApiAuthorized>[0];
  if (!isDispensaryBotApiAuthorized(req)) {
    return jsonError(401, 'Non autorisé');
  }

  const dispensaryId = getDispensaryIdFromBotRequest(req);
  if (!dispensaryId) {
    return jsonError(400, 'X-Dispensary-Id requis');
  }

  const dispensary = await prisma.dispensary.findUnique({
    where: { id: dispensaryId },
    select: { id: true },
  });
  if (!dispensary) {
    return jsonError(404, 'Dispensaire introuvable');
  }

  const featureBlock = await getAppFeatureActionBlock(dispensaryId, 'bank');
  if (featureBlock) {
    return jsonError(featureBlock.status, featureBlock.error);
  }

  const botSecret = process.env.BANK_BOT_API_SECRET;
  if (!botSecret) {
    return jsonError(500, 'BANK_BOT_API_SECRET non configuré');
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date');
  const upstream = new URL(`${getBankUrl()}/api/bot/materialize-planned`);
  if (dateParam) {
    upstream.searchParams.set('date', dateParam);
  }

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botSecret}`,
        'X-Scope-Type': 'dispensary',
        'X-Scope-Id': dispensaryId,
        'X-Dispensary-Id': dispensaryId,
      },
      cache: 'no-store',
    });

    const body = await response.json().catch(() => ({ error: 'Réponse bank invalide' }));
    if (!response.ok) {
      return jsonError(
        response.status,
        typeof body.error === 'string' ? body.error : 'Erreur bank service',
      );
    }

    const data = body as {
      date?: string;
      created?: unknown[];
      alreadyPending?: unknown[];
      counts?: { created: number; alreadyPending: number };
    };

    return NextResponse.json({
      status: 200,
      data: {
        date: data.date?.slice(0, 10),
        created: data.created ?? [],
        alreadyPending: data.alreadyPending ?? [],
        createdCount: data.counts?.created ?? (data.created?.length ?? 0),
        alreadyPendingCount:
          data.counts?.alreadyPending ?? (data.alreadyPending?.length ?? 0),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return jsonError(500, msg);
  }
}
