import { NextResponse } from 'next/server';
import {
  isDispensaryBotApiAuthorized,
  getDispensaryIdFromBotRequest,
} from '@/lib/dispensaryWeeklyActivityApiAuth';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import prisma from '@/lib/prisma';
import { materializePlannedOccurrencesForDay, startOfParisDay } from '@/lib/bank/planned';
import dayjs from '@/lib/dayjs';
import { parseISO } from 'date-fns';

function jsonError(status: number, error: string) {
  return NextResponse.json({ status, error }, { status });
}

/**
 * Materialize pending bank planned occurrences for a dispensary day (Europe/Paris).
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

  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date')?.trim();
  let targetDate = new Date();
  if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return jsonError(400, 'Format de date invalide (attendu YYYY-MM-DD)');
    }
    targetDate = startOfParisDay(parseISO(dateParam));
    if (Number.isNaN(targetDate.getTime())) {
      return jsonError(400, 'Date invalide');
    }
  }

  try {
    const result = await materializePlannedOccurrencesForDay(dispensaryId, targetDate);
    return NextResponse.json({
      status: 200,
      data: {
        date: dayjs(result.date).tz('Europe/Paris').format('YYYY-MM-DD'),
        created: result.created,
        alreadyPending: result.alreadyPending,
        createdCount: result.created.length,
        alreadyPendingCount: result.alreadyPending.length,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return jsonError(500, msg);
  }
}
