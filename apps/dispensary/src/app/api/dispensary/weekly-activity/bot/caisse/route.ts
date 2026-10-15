import { withBotRouteLog } from '@/lib/logs/botRoute';
import { getAppSettings } from '@/lib/appSettings';
import { isDispensaryBotApiAuthorized, getDiscordUserIdFromBotRequest } from '@/lib/dispensaryWeeklyActivityApiAuth';
import {
  botWeekdayFieldVisibilityError,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import {
  botEditWeekdayFlag,
  isCaisseEditBody,
  jsonBotError,
  mapBotRouteError,
  respondToBotWeekdayFlagResult,
} from '@/lib/dispensaryWeeklyActivity/botRouteHandlers';
import { dispensaryWeeklyActivityBotCaisseBodySchema } from '@/lib/dispensaryWeeklyActivity/schemas';
import { botMarkChestForParisToday } from '@/lib/dispensaryWeeklyActivity/service';
import { resolveBotDispensaryContext } from '@/lib/dispensaryWeeklyActivity/botRequestContext';

async function handlePost(request: Request) {
  const req = request as Parameters<typeof isDispensaryBotApiAuthorized>[0];
  if (!isDispensaryBotApiAuthorized(req)) {
    return jsonBotError(401, 'Non autorisé');
  }
  const dispensaryCtx = await resolveBotDispensaryContext(req);
  if (!dispensaryCtx.ok) {
    return jsonBotError(dispensaryCtx.status, dispensaryCtx.error);
  }

  const discordUserId = getDiscordUserIdFromBotRequest(req);
  if (!discordUserId) {
    return jsonBotError(400, 'En-tête X-Discord-User-Id requis');
  }

  const text = await request.text();
  let body: unknown = {};
  if (text.trim() !== '') {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return jsonBotError(400, 'Corps JSON invalide');
    }
  }

  const parsed = dispensaryWeeklyActivityBotCaisseBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonBotError(422, parsed.error.issues[0]?.message ?? 'Données invalides');
  }

  const settings = await getAppSettings(dispensaryCtx.dispensaryId);
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
  const hiddenErr = botWeekdayFieldVisibilityError('chest', visibility);
  if (hiddenErr) {
    return jsonBotError(403, hiddenErr);
  }

  try {
    if (isCaisseEditBody(parsed.data)) {
      const result = await botEditWeekdayFlag(
        dispensaryCtx.dispensaryId,
        discordUserId,
        'chest',
        parsed.data,
      );
      return respondToBotWeekdayFlagResult(dispensaryCtx.dispensaryId, result);
    }

    const result = await botMarkChestForParisToday(dispensaryCtx.dispensaryId, discordUserId, {
      displayName: parsed.data.displayName,
    });
    return respondToBotWeekdayFlagResult(dispensaryCtx.dispensaryId, result);
  } catch (e) {
    return mapBotRouteError(e);
  }
}

export const POST = withBotRouteLog(
  { feature: 'weeklyDispensaryActivity', event: 'bot.caisse' },
  handlePost,
);
