import { withBotRouteLog } from '@/lib/logs/botRoute';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { BusinessWeeklyActivity } from '@prisma/client';
import { isBusinessBotApiAuthorized, getDiscordUserIdFromBotRequest } from '@/lib/businessWeeklyActivityApiAuth';
import { getAppSettings } from '@/lib/appSettings';
import {
  applyVisibilityToUpdateInput,
  botPatchFieldVisibilityError,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import { loadSerializedWeeklyActivityByIdForBusiness } from '@/lib/businessWeeklyActivity/loadSerializedRow';
import prisma from '@/lib/prisma';
import { businessWeeklyActivityBotPatchSchema } from '@/lib/businessWeeklyActivity/schemas';
import {
  deleteBusinessWeeklyActivityWithHistory,
  reconcileActivityUserIds,
  updateBusinessWeeklyActivityWithHistory,
} from '@/lib/businessWeeklyActivity/service';
import { resolveBotBusinessContext } from '@/lib/businessWeeklyActivity/botRequestContext';

function jsonError(status: number, error: string) {
  return NextResponse.json({ status, error }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

type LoadActivityForBotResult =
  | { error: NextResponse }
  | { activity: BusinessWeeklyActivity };

async function loadActivityForBot(
  request: NextRequest,
  id: string,
  discordUserId: string,
  businessId: string,
): Promise<LoadActivityForBotResult> {
  const initial = await prisma.businessWeeklyActivity.findFirst({
    where: { id, businessId },
  });

  if (!initial) {
    return { error: jsonError(404, 'Activité introuvable') };
  }

  if (initial.discordUserId !== discordUserId) {
    return { error: jsonError(403, 'Accès refusé') };
  }

  const [activity] = await reconcileActivityUserIds([initial]);

  return { activity };
}

async function handleGet(request: NextRequest, context: RouteContext) {
  if (!isBusinessBotApiAuthorized(request)) {
    return jsonError(401, 'Non autorisé');
  }
  const businessCtx = await resolveBotBusinessContext(request);
  if (!businessCtx.ok) {
    return jsonError(businessCtx.status, businessCtx.error);
  }
  const discordUserId = getDiscordUserIdFromBotRequest(request);
  if (!discordUserId) {
    return jsonError(400, 'En-tête X-Discord-User-Id requis');
  }

  const { id } = await context.params;
  const loaded = await loadActivityForBot(
    request,
    id,
    discordUserId,
    businessCtx.businessId,
  );
  if ('error' in loaded) {
    return loaded.error;
  }

  const data = await loadSerializedWeeklyActivityByIdForBusiness(
    id,
    businessCtx.businessId,
  );
  if (!data) {
    return jsonError(404, 'Activité introuvable');
  }
  return NextResponse.json({ status: 200, data });
}

async function handlePatch(request: NextRequest, context: RouteContext) {
  if (!isBusinessBotApiAuthorized(request)) {
    return jsonError(401, 'Non autorisé');
  }
  const businessCtx = await resolveBotBusinessContext(request);
  if (!businessCtx.ok) {
    return jsonError(businessCtx.status, businessCtx.error);
  }
  const discordUserId = getDiscordUserIdFromBotRequest(request);
  if (!discordUserId) {
    return jsonError(400, 'En-tête X-Discord-User-Id requis');
  }

  const { id } = await context.params;
  const loaded = await loadActivityForBot(
    request,
    id,
    discordUserId,
    businessCtx.businessId,
  );
  if ('error' in loaded) {
    return loaded.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Corps JSON invalide');
  }

  const parsed = businessWeeklyActivityBotPatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, parsed.error.issues[0]?.message ?? 'Données invalides');
  }

  const settings = await getAppSettings(businessCtx.businessId);
  const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
  const fieldError = botPatchFieldVisibilityError(parsed.data, visibility);
  if (fieldError) {
    return jsonError(403, fieldError);
  }
  const updateInput = applyVisibilityToUpdateInput(parsed.data, visibility);

  try {
    await updateBusinessWeeklyActivityWithHistory(id, updateInput, {
      source: 'DISCORD_BOT',
      actorUserId: null,
      actorDiscordUserId: discordUserId,
      businessId: businessCtx.businessId,
    });

    const data = await loadSerializedWeeklyActivityByIdForBusiness(
      id,
      businessCtx.businessId,
    );
    if (!data) {
      return jsonError(500, 'Erreur après mise à jour');
    }
    return NextResponse.json({ status: 200, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    if (msg.includes('Unique constraint')) {
      return jsonError(409, 'Conflit de période');
    }
    throw e;
  }
}

async function handleDelete(request: NextRequest, context: RouteContext) {
  if (!isBusinessBotApiAuthorized(request)) {
    return jsonError(401, 'Non autorisé');
  }
  const businessCtx = await resolveBotBusinessContext(request);
  if (!businessCtx.ok) {
    return jsonError(businessCtx.status, businessCtx.error);
  }
  const discordUserId = getDiscordUserIdFromBotRequest(request);
  if (!discordUserId) {
    return jsonError(400, 'En-tête X-Discord-User-Id requis');
  }

  const { id } = await context.params;
  const loaded = await loadActivityForBot(
    request,
    id,
    discordUserId,
    businessCtx.businessId,
  );
  if ('error' in loaded) {
    return loaded.error;
  }

  await deleteBusinessWeeklyActivityWithHistory(id, {
    source: 'DISCORD_BOT',
    actorUserId: null,
    actorDiscordUserId: discordUserId,
    businessId: businessCtx.businessId,
  });
  return NextResponse.json({ status: 200, data: { ok: true } });
}

export const GET = withBotRouteLog(
  { feature: 'weeklyDispensaryActivity', event: 'bot.weeklyActivity.get' },
  handleGet,
);

export const PATCH = withBotRouteLog(
  { feature: 'weeklyDispensaryActivity', event: 'bot.weeklyActivity.update' },
  handlePatch,
);

export const DELETE = withBotRouteLog(
  { feature: 'weeklyDispensaryActivity', event: 'bot.weeklyActivity.delete' },
  handleDelete,
);
