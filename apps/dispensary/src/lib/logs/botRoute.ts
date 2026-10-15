import { NextResponse } from 'next/server';
import {
  getDiscordUserIdFromBotRequest,
  getDispensaryIdFromBotRequest,
  isDispensaryBotApiAuthorized,
} from '@/lib/dispensaryWeeklyActivityApiAuth';
import { serializeError } from './sanitize';
import { levelFromOutcome, outcomeFromStatus, type LogFeature, type LogOutcome } from './types';
import { writeAppLog } from './writer';

type BotRequest = Parameters<typeof isDispensaryBotApiAuthorized>[0];

/** What the bot got back, without large payloads: errors, flags, ids and list sizes. */
export function summarizeBotResponse(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body ?? null;
  const { status, error, data } = body as { status?: unknown; error?: unknown; data?: unknown };
  if (error !== undefined) return { status, error };
  if (Array.isArray(data)) return { status, count: data.length };
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const activity = record.activity as { id?: unknown } | null | undefined;
    return {
      status,
      ...('alreadyDone' in record ? { alreadyDone: record.alreadyDone } : {}),
      ...('message' in record ? { message: record.message } : {}),
      ...('id' in record ? { id: record.id } : {}),
      ...(activity ? { activityId: activity.id } : {}),
    };
  }
  return { status };
}

function outcomeOf(httpStatus: number, summary: unknown): LogOutcome {
  const alreadyDone = (summary as { alreadyDone?: unknown } | null)?.alreadyDone === true;
  return httpStatus < 300 && alreadyDone ? 'noop' : outcomeFromStatus(httpStatus);
}

function parseJson(text: string | null): unknown {
  if (!text?.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

/**
 * Logs every request of a Discord bot route, whatever happens: who (Discord id),
 * which dispensary, the body, the HTTP status, the duration and what the bot
 * got back. An exception thrown by the handler is logged with its stack and
 * becomes a generic 500 (the raw message is never sent to the bot).
 * No log line at all for a click means the request never reached the server.
 */
export function withBotRouteLog<Req extends Request, Ctx = unknown>(
  meta: { feature: LogFeature; event: string },
  handler: (request: Req, context: Ctx) => Promise<Response>,
) {
  return async function loggedBotRoute(request: Req, context: Ctx): Promise<Response> {
    const startedAt = Date.now();
    // The bot helpers only read headers and the URL, which every Request has.
    const botRequest = request as unknown as BotRequest;
    const authorized = isDispensaryBotApiAuthorized(botRequest);
    const url = new URL(request.url);
    // The body is only read from authorized requests (no secrets, no junk from strangers).
    const bodyText =
      authorized && request.method !== 'GET' ? await request.clone().text().catch(() => null) : null;

    let response: Response;
    let thrown: unknown;
    try {
      response = await handler(request, context);
    } catch (error) {
      thrown = error;
      response = NextResponse.json({ status: 500, error: 'Erreur serveur, réessayez' }, { status: 500 });
    }

    const summary = summarizeBotResponse(await response.clone().json().catch(() => null));
    const outcome = outcomeOf(response.status, summary);
    const reason =
      (summary as { error?: unknown; message?: unknown } | null)?.error ??
      (summary as { message?: unknown } | null)?.message;

    writeAppLog({
      level: levelFromOutcome(outcome),
      kind: 'BOT_REQUEST',
      feature: meta.feature,
      event: meta.event,
      outcome,
      message: `${request.method} ${url.pathname} → ${response.status}${
        typeof reason === 'string' ? ` : ${reason}` : ''
      }`,
      source: 'DISCORD_BOT',
      dispensaryId: getDispensaryIdFromBotRequest(botRequest),
      discordUserId: getDiscordUserIdFromBotRequest(botRequest),
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      path: url.pathname,
      context: {
        authorized,
        query: Object.fromEntries(url.searchParams),
        body: parseJson(bodyText),
        response: summary,
      },
      error: thrown === undefined ? undefined : serializeError(thrown),
    });

    return response;
  };
}
