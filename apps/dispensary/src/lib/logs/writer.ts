import { after } from 'next/server';
import { headers } from 'next/headers';
import type { Prisma } from '@/generated/prisma/client';
import { getAuthSession } from '@/lib/authSession';
import { resolveDispensaryFromSlug } from '@/lib/dispensary/context';
import prisma from '@/lib/prisma';
import { dispensarySlugFromPath, featureFromPath } from './paths';
import { sanitizeLogContext, serializeError } from './sanitize';
import {
  levelFromOutcome,
  outcomeFromStatus,
  type AppLogEntry,
  type LogFeature,
  type LogOutcome,
} from './types';

/**
 * Writes one log line. Never throws and never delays the caller: the write runs
 * in the background and `after()` keeps the request alive until it ends.
 * Outside a request (startup jobs), the write simply runs in the background.
 */
export function writeAppLog(entry: AppLogEntry | Promise<AppLogEntry | null>): void {
  const task = Promise.resolve(entry)
    .then((resolved) => (resolved ? persist(resolved) : undefined))
    .catch((error: unknown) => {
      console.error('[app-log] write failed', error);
    });
  try {
    after(task);
  } catch {
    // Outside a request scope: the task is already running.
  }
}

async function persist(entry: AppLogEntry): Promise<void> {
  await prisma.appLog.create({
    data: {
      level: entry.level,
      kind: entry.kind,
      feature: entry.feature,
      event: entry.event,
      outcome: entry.outcome ?? null,
      message: entry.message.slice(0, 2_000),
      source: entry.source,
      dispensaryId: entry.dispensaryId ?? null,
      userId: entry.userId ?? null,
      discordUserId: entry.discordUserId ?? null,
      httpStatus: entry.httpStatus ?? null,
      durationMs: entry.durationMs ?? null,
      path: entry.path?.slice(0, 500) ?? null,
      context: toJson(sanitizeLogContext(entry.context)),
      error: toJson(entry.error),
    },
  });
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);
}

export type RequestLogContext = {
  path: string | null;
  feature: LogFeature;
  dispensaryId: string | null;
  userId: string | null;
};

/**
 * Who and where, for a server action or a read route: the page it was called
 * from (`referer`), the dispensary of that page and the signed-in user.
 * Best effort: any missing piece stays null.
 */
export async function resolveRequestLogContext(): Promise<RequestLogContext> {
  let path: string | null = null;
  try {
    const referer = (await headers()).get('referer');
    path = referer ? new URL(referer).pathname : null;
  } catch {
    path = null;
  }
  const slug = dispensarySlugFromPath(path);
  const [session, dispensary] = await Promise.all([
    getAuthSession().catch(() => null),
    slug ? resolveDispensaryFromSlug(slug).catch(() => null) : Promise.resolve(null),
  ]);
  return {
    path,
    feature: featureFromPath(path),
    dispensaryId: dispensary?.id ?? null,
    userId: session?.user?.id ?? null,
  };
}

type ActionLogInput = {
  feature: LogFeature;
  event: string;
  outcome: LogOutcome;
  message: string;
  context?: unknown;
  error?: unknown;
  httpStatus?: number;
  durationMs?: number;
  dispensaryId?: string | null;
  userId?: string | null;
  discordUserId?: string | null;
  source?: 'INTRANET' | 'DISCORD_BOT' | 'SYSTEM';
};

/** One action of a sensitive feature (success, refusal or failure). Missing who/where come from the request. */
export function logAction(input: ActionLogInput): void {
  writeAppLog(
    resolveRequestLogContext().then((request) => ({
      level: levelFromOutcome(input.outcome),
      kind: 'ACTION' as const,
      feature: input.feature,
      event: input.event,
      outcome: input.outcome,
      message: input.message,
      source: input.source ?? 'INTRANET',
      dispensaryId: input.dispensaryId ?? request.dispensaryId,
      userId: input.userId ?? request.userId,
      discordUserId: input.discordUserId ?? null,
      httpStatus: input.httpStatus ?? null,
      durationMs: input.durationMs ?? null,
      path: request.path,
      context: input.context,
      error: input.error === undefined ? undefined : serializeError(input.error),
    })),
  );
}

/** Unexpected server error of any feature (registered as the error reporter, see instrumentation.ts). */
export function logServerError(input: {
  error: unknown;
  status: number;
  message: string;
  feature?: string;
  dispensaryId?: string;
  event?: string;
}): void {
  writeAppLog(
    resolveRequestLogContext().then((request) => ({
      level: 'ERROR' as const,
      kind: 'ERROR' as const,
      feature: (input.feature as LogFeature | undefined) ?? request.feature,
      event: input.event ?? 'action.error',
      outcome: 'failure' as const,
      message: input.message,
      source: 'INTRANET' as const,
      dispensaryId: input.dispensaryId ?? request.dispensaryId,
      userId: request.userId,
      httpStatus: input.status,
      path: request.path,
      error: serializeError(input.error),
    })),
  );
}

const OUTCOME_LABELS: Record<LogOutcome, string> = {
  success: 'réussi',
  noop: 'rien à faire',
  denied: 'refusé',
  invalid: 'invalide',
  failure: 'échec',
};

type ActionResult = { status: number; error?: unknown; data?: unknown };

/**
 * Runs a server action of a sensitive feature and logs its result: success,
 * refusal (401/403), invalid input (other 4xx) or failure (5xx or exception,
 * rethrown). `describe` adds details from the result (outcome override, context).
 */
export async function withLoggedAction<R extends ActionResult>(
  meta: { feature: LogFeature; event: string; label: string; context?: unknown },
  run: () => Promise<R>,
  describe?: (result: R) => { outcome?: LogOutcome; context?: unknown } | undefined,
): Promise<R> {
  const startedAt = Date.now();
  try {
    const result = await run();
    const extra = describe?.(result);
    const outcome = extra?.outcome ?? outcomeFromStatus(result.status);
    const reason = typeof result.error === 'string' ? ` : ${result.error}` : '';
    logAction({
      feature: meta.feature,
      event: meta.event,
      outcome,
      message: `${meta.label} (${OUTCOME_LABELS[outcome]})${reason}`,
      httpStatus: result.status,
      durationMs: Date.now() - startedAt,
      context: { input: meta.context, ...(extra?.context === undefined ? {} : { result: extra.context }) },
    });
    return result;
  } catch (error) {
    logAction({
      feature: meta.feature,
      event: meta.event,
      outcome: 'failure',
      message: `${meta.label} (échec) : ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - startedAt,
      context: { input: meta.context },
      error,
    });
    throw error;
  }
}
