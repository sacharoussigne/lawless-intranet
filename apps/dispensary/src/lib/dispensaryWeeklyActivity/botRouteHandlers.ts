import { NextResponse } from 'next/server';
import { findFixedDisplayName } from '@/lib/dispensaryDiscordProfile/service';
import prisma from '@/lib/prisma';
import { getAppSettings } from '@/lib/appSettings';
import { serializeDispensaryWeeklyActivityApiRow } from '@/lib/dispensaryWeeklyActivity/apiRow';
import { BotDayEditError, resolveParisDayAnchor } from '@/lib/dispensaryWeeklyActivity/botDayEdit';
import {
  redactSerializedWeeklyActivityRow,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import { loadSerializedWeeklyActivityByIdForDispensary } from '@/lib/dispensaryWeeklyActivity/loadSerializedRow';
import { logServerError } from '@/lib/logs/writer';
import type { BotWeekdayFlagMarkResult } from '@/lib/dispensaryWeeklyActivity/service';
import { botSetWeekdayFlag } from '@/lib/dispensaryWeeklyActivity/service';

export function jsonBotError(status: number, error: string) {
  return NextResponse.json({ status, error }, { status });
}

/**
 * The write is already committed here: if reloading the full row fails, answer
 * from the row we have (without the Discord profile enrichment) instead of a
 * 500 that would make the bot report a failure. The reload error is logged.
 */
async function serializeFlagResultActivity(dispensaryId: string, result: BotWeekdayFlagMarkResult) {
  try {
    const loaded = await loadSerializedWeeklyActivityByIdForDispensary(result.activity.id, dispensaryId);
    if (loaded) return loaded;
  } catch (error) {
    logServerError({
      error,
      status: 500,
      message: 'Rechargement de l’activité impossible après la mise à jour (réponse dégradée)',
      feature: 'weeklyDispensaryActivity',
      dispensaryId,
      event: 'bot.weeklyActivity.reload',
    });
  }
  const row = result.activity;
  const visibility = weeklyActivityFieldVisibilityFromSettings(await getAppSettings(dispensaryId));
  return redactSerializedWeeklyActivityRow(
    serializeDispensaryWeeklyActivityApiRow({
      ...row,
      resolvedDisplayName:
        (await findFixedDisplayName(prisma, dispensaryId, row.discordUserId)) ?? row.displayName,
      discordProfileRole: null,
      discordProfileAccountNumber: null,
    }),
    visibility,
  );
}

export async function respondToBotWeekdayFlagResult(
  dispensaryId: string,
  result: BotWeekdayFlagMarkResult,
) {
  const serialized = await serializeFlagResultActivity(dispensaryId, result);
  if (result.outcome === 'already_done') {
    return NextResponse.json({
      status: 200,
      data: { alreadyDone: true, message: result.message, activity: serialized },
    });
  }
  return NextResponse.json({
    status: 200,
    data: { alreadyDone: false, activity: serialized },
  });
}

/** Expected errors become a 4xx for the bot; anything else is rethrown (logged with its stack by withBotRouteLog). */
export function mapBotRouteError(e: unknown): NextResponse {
  if (e instanceof BotDayEditError) {
    return jsonBotError(400, e.message);
  }
  throw e;
}

export async function botEditWeekdayFlag(
  dispensaryId: string,
  discordUserId: string,
  field: 'chest' | 'presence',
  input: BotDayEditRequestBody,
) {
  const dayAnchor = resolveParisDayAnchor({ weekday: input.weekday, date: input.date });
  return botSetWeekdayFlag(dispensaryId, discordUserId, field, dayAnchor, input.value, {
    displayName: input.displayName,
  });
}

export type BotDayEditRequestBody = {
  weekday?: Parameters<typeof resolveParisDayAnchor>[0]['weekday'];
  date?: string;
  value: boolean;
  displayName?: string;
};

export function isCaisseEditBody(body: {
  weekday?: string;
  date?: string;
  value?: boolean;
  displayName?: string;
}): body is BotDayEditRequestBody {
  return body.weekday !== undefined || body.date !== undefined || body.value !== undefined;
}

export function isPresenceEditBody(body: {
  day?: string;
  weekday?: string;
  date?: string;
  value?: boolean;
  displayName?: string;
}): body is BotDayEditRequestBody {
  return body.weekday !== undefined || body.date !== undefined || body.value !== undefined;
}
