import { after } from 'next/server';
import { headers } from 'next/headers';
import type { Prisma } from '@/generated/prisma/client';
import { getAuthSession } from '@/lib/authSession';
import { resolveDispensaryFromSlug } from '@/lib/dispensary/context';
import prisma from '@/lib/prisma';
import { LOG_FEATURE_LABELS } from './labels';
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
  /** Tenant slug of the action: resolves the dispensary when `dispensaryId` is not given. */
  dispensarySlug?: string | null;
  userId?: string | null;
  discordUserId?: string | null;
  source?: 'INTRANET' | 'DISCORD_BOT' | 'SYSTEM';
};

async function resolveDispensaryId(input: ActionLogInput, request: RequestLogContext) {
  if (input.dispensaryId) return input.dispensaryId;
  if (input.dispensarySlug) {
    const dispensary = await resolveDispensaryFromSlug(input.dispensarySlug).catch(() => null);
    if (dispensary) return dispensary.id;
  }
  return request.dispensaryId;
}

/** One action of a sensitive feature (success, refusal or failure). Missing who/where come from the request. */
export function logAction(input: ActionLogInput): void {
  writeAppLog(
    resolveRequestLogContext().then(async (request) => ({
      level: levelFromOutcome(input.outcome),
      kind: 'ACTION' as const,
      feature: input.feature,
      event: input.event,
      outcome: input.outcome,
      message: input.message,
      source: input.source ?? 'INTRANET',
      dispensaryId: await resolveDispensaryId(input, request),
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

type LoggedRunMeta = {
  feature: LogFeature;
  event: string;
  label: string;
  context?: unknown;
  dispensarySlug?: string;
};

async function runLogged<R extends ActionResult>(
  meta: LoggedRunMeta,
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
      dispensarySlug: meta.dispensarySlug,
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
      dispensarySlug: meta.dispensarySlug,
      context: { input: meta.context },
      error,
    });
    throw error;
  }
}

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
  return runLogged(meta, run, describe);
}

/** Features whose actions take the dispensary slug as first argument. */
const NON_TENANT_FEATURES = new Set<LogFeature>(['platform', 'account']);

/**
 * Mutation of any feature: logs every call, whatever the outcome (see
 * docs/APP-LOGS.md). `args` are the action arguments: the first one is the
 * dispensary slug for tenant features, the rest goes to the log context
 * (sanitized). Pass `context` instead when arguments hold secrets or large content.
 */
export async function loggedAction<A extends unknown[], R extends ActionResult>(
  meta: { feature: LogFeature; event: string; label?: string; context?: unknown },
  args: A,
  run: () => Promise<R>,
): Promise<R> {
  const tenant = !NON_TENANT_FEATURES.has(meta.feature) && typeof args[0] === 'string';
  const actionName = meta.event.split('.').pop() ?? meta.event;
  return runLogged(
    {
      feature: meta.feature,
      event: meta.event,
      label: meta.label ?? `${LOG_FEATURE_LABELS[meta.feature]} · ${actionName}`,
      dispensarySlug: tenant ? (args[0] as string) : undefined,
      context: 'context' in meta ? meta.context : tenant ? args.slice(1) : args,
    },
    run,
  );
}
