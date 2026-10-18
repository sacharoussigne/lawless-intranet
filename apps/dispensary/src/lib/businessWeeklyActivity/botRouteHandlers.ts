import { NextResponse } from 'next/server';
import { findFixedDisplayName } from '@/lib/businessDiscordProfile/service';
import prisma from '@/lib/prisma';
import { getAppSettings } from '@/lib/appSettings';
import { serializeBusinessWeeklyActivityApiRow } from '@/lib/businessWeeklyActivity/apiRow';
import { BotDayEditError, resolveParisDayAnchor } from '@/lib/businessWeeklyActivity/botDayEdit';
import {
  redactSerializedWeeklyActivityRow,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import { loadSerializedWeeklyActivityByIdForBusiness } from '@/lib/businessWeeklyActivity/loadSerializedRow';
import { toBotApiRow } from '@/lib/businessWeeklyActivity/botApiRow';
import { logServerError } from '@/lib/logs/writer';
import type { BotWeekdayFlagMarkResult } from '@/lib/businessWeeklyActivity/service';
import { botSetWeekdayFlag } from '@/lib/businessWeeklyActivity/service';

export function jsonBotError(status: number, error: string) {
  return NextResponse.json({ status, error }, { status });
}

/**
 * The write is already committed here: if reloading the full row fails, answer
 * from the row we have (without the Discord profile enrichment) instead of a
 * 500 that would make the bot report a failure. The reload error is logged.
 */
async function serializeFlagResultActivity(businessId: string, result: BotWeekdayFlagMarkResult) {
  const settings = await getAppSettings(businessId);
  try {
    const loaded = await loadSerializedWeeklyActivityByIdForBusiness(result.activity.id, businessId);
    if (loaded) return toBotApiRow(loaded, settings.businessType);
  } catch (error) {
    logServerError({
      error,
      status: 500,
      message: 'Rechargement de l’activité impossible après la mise à jour (réponse dégradée)',
      feature: 'weeklyActivity',
      businessId,
      event: 'bot.weeklyActivity.reload',
    });
  }
  const row = result.activity;
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
  const redacted = redactSerializedWeeklyActivityRow(
    serializeBusinessWeeklyActivityApiRow({
      ...row,
      resolvedDisplayName:
        (await findFixedDisplayName(prisma, businessId, row.discordUserId)) ?? row.displayName,
      discordProfileRole: null,
      discordProfileAccountNumber: null,
    }),
    visibility,
  );
  return toBotApiRow(redacted, settings.businessType);
}

export async function respondToBotWeekdayFlagResult(
  businessId: string,
  result: BotWeekdayFlagMarkResult,
) {
  const serialized = await serializeFlagResultActivity(businessId, result);
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
  businessId: string,
  discordUserId: string,
  field: 'chest' | 'presence',
  input: BotDayEditRequestBody,
) {
  const dayAnchor = resolveParisDayAnchor({ weekday: input.weekday, date: input.date });
  return botSetWeekdayFlag(businessId, discordUserId, field, dayAnchor, input.value, {
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
