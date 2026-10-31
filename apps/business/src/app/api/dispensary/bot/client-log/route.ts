import { NextResponse } from 'next/server';
import {
  getBusinessIdFromBotRequest,
  getDiscordUserIdFromBotRequest,
  isBusinessBotApiAuthorized,
} from '@/lib/businessWeeklyActivityApiAuth';
import { jsonBotError } from '@/lib/businessWeeklyActivity/botRouteHandlers';
import {
  botClientLogEntry,
  botClientLogSchema,
  MAX_BOT_CLIENT_LOG_LENGTH,
} from '@/lib/logs/botClientLog';
import { writeAppLog } from '@/lib/logs/writer';

/**
 * Bot only: errors on the bot's side (late acknowledgement, intranet unreachable,
 * exception), which never reach the other routes. One log line per report, so this
 * route is not wrapped by `withBotRouteLog`.
 */
export async function POST(request: Request) {
  const req = request as Parameters<typeof isBusinessBotApiAuthorized>[0];
  if (!isBusinessBotApiAuthorized(req)) {
    return jsonBotError(401, 'Non autorisé');
  }

  const text = await request.text();
  if (text.length > MAX_BOT_CLIENT_LOG_LENGTH) {
    return jsonBotError(413, 'Rapport trop volumineux');
  }
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return jsonBotError(400, 'Corps JSON invalide');
  }
  const parsed = botClientLogSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBotError(422, parsed.error.issues[0]?.message ?? 'Données invalides');
  }

  writeAppLog(
    botClientLogEntry(parsed.data, {
      businessId: getBusinessIdFromBotRequest(req),
      discordUserId: getDiscordUserIdFromBotRequest(req),
    }),
  );
  return NextResponse.json({ status: 200, data: { logged: true } });
}
