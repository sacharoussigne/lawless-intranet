import { NextResponse } from 'next/server';
import { listBusinessesForBot } from '@/lib/business/botBusinessList';
import { isBusinessBotApiAuthorized } from '@/lib/businessWeeklyActivityApiAuth';
import { jsonBotError } from '@/lib/businessWeeklyActivity/botRouteHandlers';
import { withBotRouteLog } from '@/lib/logs/botRoute';

/** Bot only (Bearer secret, no `X-Dispensary-Id`): businesses a Discord server can be linked to in `/config`. */
async function handleGet(request: Request) {
  const req = request as Parameters<typeof isBusinessBotApiAuthorized>[0];
  if (!isBusinessBotApiAuthorized(req)) {
    return jsonBotError(401, 'Non autorisé');
  }
  return NextResponse.json({ status: 200, data: await listBusinessesForBot() });
}

export const GET = withBotRouteLog({ feature: 'platform', event: 'bot.businesses.list' }, handleGet);
