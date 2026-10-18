import { withBotRouteLog } from '@/lib/logs/botRoute';
import { NextResponse } from 'next/server';
import { isBusinessBotApiAuthorized, getDiscordUserIdFromBotRequest } from '@/lib/businessWeeklyActivityApiAuth';
import { businessWeeklyActivityCreateSchema } from '@/lib/businessWeeklyActivity/schemas';
import { getAppSettings } from '@/lib/appSettings';
import {
  applyVisibilityToCreateInput,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import { loadSerializedWeeklyActivityByIdForBusiness } from '@/lib/businessWeeklyActivity/loadSerializedRow';
import { listSerializedWeeklyActivities } from '@/lib/businessWeeklyActivity/listSerialized';
import { createBusinessWeeklyActivityWithHistory } from '@/lib/businessWeeklyActivity/service';
import { resolveBotBusinessContext } from '@/lib/businessWeeklyActivity/botRequestContext';

function jsonError(status: number, error: string) {
  return NextResponse.json({ status, error }, { status });
}

async function handleGet(request: Request) {
  const req = request as Parameters<typeof isBusinessBotApiAuthorized>[0];
  if (!isBusinessBotApiAuthorized(req)) {
    return jsonError(401, 'Non autorisé');
  }
  const businessCtx = await resolveBotBusinessContext(req);
  if (!businessCtx.ok) {
    return jsonError(businessCtx.status, businessCtx.error);
  }
  const discordUserId = getDiscordUserIdFromBotRequest(req);
  if (!discordUserId) {
    return jsonError(400, 'En-tête X-Discord-User-Id requis');
  }

  const data = await listSerializedWeeklyActivities(
    { businessId: businessCtx.businessId, discordUserId },
    businessCtx.businessId,
  );

  return NextResponse.json({ status: 200, data });
}

async function handlePost(request: Request) {
  const req = request as Parameters<typeof isBusinessBotApiAuthorized>[0];
  if (!isBusinessBotApiAuthorized(req)) {
    return jsonError(401, 'Non autorisé');
  }
  const businessCtx = await resolveBotBusinessContext(req);
  if (!businessCtx.ok) {
    return jsonError(businessCtx.status, businessCtx.error);
  }
  const discordUserId = getDiscordUserIdFromBotRequest(req);
  if (!discordUserId) {
    return jsonError(400, 'En-tête X-Discord-User-Id requis');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Corps JSON invalide');
  }

  const parsed = businessWeeklyActivityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, parsed.error.issues[0]?.message ?? 'Données invalides');
  }

  if (parsed.data.discordUserId !== discordUserId) {
    return jsonError(403, 'Le Discord ID du corps doit correspondre à l’en-tête');
  }

  try {
    const settings = await getAppSettings(businessCtx.businessId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const createInput = applyVisibilityToCreateInput(parsed.data, visibility);

    const created = await createBusinessWeeklyActivityWithHistory(createInput, {
      source: 'DISCORD_BOT',
      actorUserId: null,
      actorDiscordUserId: discordUserId,
      businessId: businessCtx.businessId,
    });

    const data = await loadSerializedWeeklyActivityByIdForBusiness(
      created.id,
      businessCtx.businessId,
    );
    if (!data) {
      return jsonError(500, 'Erreur après création');
    }

    return NextResponse.json({
      status: 200,
      data,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    if (msg.includes('Unique constraint')) {
      return jsonError(409, 'Une entrée existe déjà pour cette période et ce médecin');
    }
    throw e;
  }
}

export const GET = withBotRouteLog(
  { feature: 'weeklyDispensaryActivity', event: 'bot.weeklyActivity.list' },
  handleGet,
);

export const POST = withBotRouteLog(
  { feature: 'weeklyDispensaryActivity', event: 'bot.weeklyActivity.create' },
  handlePost,
);
