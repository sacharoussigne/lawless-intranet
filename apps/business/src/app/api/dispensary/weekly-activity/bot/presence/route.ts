import { withBotRouteLog } from '@/lib/logs/botRoute';
import { getAppSettings } from '@/lib/appSettings';
import { isBusinessBotApiAuthorized, getDiscordUserIdFromBotRequest } from '@/lib/businessWeeklyActivityApiAuth';
import {
  botWeekdayFieldVisibilityError,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import {
  botEditWeekdayFlag,
  isPresenceEditBody,
  jsonBotError,
  mapBotRouteError,
  respondToBotWeekdayFlagResult,
} from '@/lib/businessWeeklyActivity/botRouteHandlers';
import { businessWeeklyActivityBotPresenceBodySchema } from '@/lib/businessWeeklyActivity/schemas';
import { botMarkPresenceForParisRelativeDay } from '@/lib/businessWeeklyActivity/service';
import { resolveBotBusinessContext } from '@/lib/businessWeeklyActivity/botRequestContext';
import { CASH_PREPARER_ONLY_CHEST_MESSAGE, isCashPreparer } from '@/lib/businessWeeklyActivity/botCashPreparer';

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonBotError(400, 'Corps JSON invalide');
  }

  const parsed = businessWeeklyActivityBotPresenceBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonBotError(422, parsed.error.issues[0]?.message ?? 'Données invalides');
  }

  const settings = await getAppSettings(businessCtx.businessId);
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
  const hiddenErr = botWeekdayFieldVisibilityError('presence', visibility);
  if (hiddenErr) {
    return jsonBotError(403, hiddenErr);
  }
  // Cash preparers have no presence; unchecking a day stays allowed to clean up.
  const marks = !isPresenceEditBody(parsed.data) || parsed.data.value;
  if (marks && (await isCashPreparer(businessCtx.businessId, businessCtx.businessType, discordUserId))) {
    return jsonBotError(403, CASH_PREPARER_ONLY_CHEST_MESSAGE);
  }

  try {
    if (isPresenceEditBody(parsed.data)) {
      const result = await botEditWeekdayFlag(
        businessCtx.businessId,
        discordUserId,
        'presence',
        parsed.data,
      );
      return respondToBotWeekdayFlagResult(businessCtx.businessId, result);
    }

    const relative = parsed.data.day ?? 'today';
    const result = await botMarkPresenceForParisRelativeDay(
      businessCtx.businessId,
      discordUserId,
      relative,
      {
        displayName: parsed.data.displayName,
      },
    );
    return respondToBotWeekdayFlagResult(businessCtx.businessId, result);
  } catch (e) {
    return mapBotRouteError(e);
  }
}

export const POST = withBotRouteLog(
  { feature: 'weeklyActivity', event: 'bot.presence' },
  handlePost,
);
