import { withBotRouteLog } from '@/lib/logs/botRoute';
import { getAppSettings } from '@/lib/appSettings';
import { isBusinessBotApiAuthorized, getDiscordUserIdFromBotRequest } from '@/lib/businessWeeklyActivityApiAuth';
import {
  botWeekdayFieldVisibilityError,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import {
  botEditWeekdayFlag,
  isCaisseEditBody,
  jsonBotError,
  mapBotRouteError,
  respondToBotWeekdayFlagResult,
} from '@/lib/businessWeeklyActivity/botRouteHandlers';
import { businessWeeklyActivityBotCaisseBodySchema } from '@/lib/businessWeeklyActivity/schemas';
import { botMarkChestForParisToday } from '@/lib/businessWeeklyActivity/service';
import { resolveBotBusinessContext } from '@/lib/businessWeeklyActivity/botRequestContext';

async function handlePost(request: Request) {
  const req = request as Parameters<typeof isBusinessBotApiAuthorized>[0];
  if (!isBusinessBotApiAuthorized(req)) {
    return jsonBotError(401, 'Non autorisé');
  }
  const businessCtx = await resolveBotBusinessContext(req);
  if (!businessCtx.ok) {
    return jsonBotError(businessCtx.status, businessCtx.error);
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

  const parsed = businessWeeklyActivityBotCaisseBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonBotError(422, parsed.error.issues[0]?.message ?? 'Données invalides');
  }

  const settings = await getAppSettings(businessCtx.businessId);
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
  const hiddenErr = botWeekdayFieldVisibilityError('chest', visibility);
  if (hiddenErr) {
    return jsonBotError(403, hiddenErr);
  }

  try {
    if (isCaisseEditBody(parsed.data)) {
      const result = await botEditWeekdayFlag(
        businessCtx.businessId,
        discordUserId,
        'chest',
        parsed.data,
      );
      return respondToBotWeekdayFlagResult(businessCtx.businessId, result);
    }

    const result = await botMarkChestForParisToday(businessCtx.businessId, discordUserId, {
      displayName: parsed.data.displayName,
    });
    return respondToBotWeekdayFlagResult(businessCtx.businessId, result);
  } catch (e) {
    return mapBotRouteError(e);
  }
}

export const POST = withBotRouteLog(
  { feature: 'weeklyActivity', event: 'bot.caisse' },
  handlePost,
);
