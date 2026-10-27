import { after } from 'next/server';
import { headers } from 'next/headers';
import type { Prisma } from '@/generated/prisma/client';
import { getAuthSession } from '@/lib/authSession';
import { resolveBusinessFromSlug } from '@/lib/business/context';
import prisma from '@/lib/prisma';
import { discordIdForLog } from './actorDiscordId';
import { LOG_FEATURE_LABELS } from './labels';
import { businessSlugFromPath, featureFromPath } from './paths';
import { sanitizeLogContext, serializeError } from './sanitize';
import {
  currentActionTargetId,
  defaultTargetId,
  runWithActionTarget,
  toTargetId,
  type TargetResolver,
} from './target';
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
      businessId: entry.businessId ?? null,
      userId: entry.userId ?? null,
      discordUserId: entry.discordUserId ?? null,
      impersonatedById: entry.impersonatedById ?? null,
      httpStatus: entry.httpStatus ?? null,
      durationMs: entry.durationMs ?? null,
      path: entry.path?.slice(0, 500) ?? null,
      targetId: entry.targetId ?? null,
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
  businessId: string | null;
  userId: string | null;
  /** Platform admin acting as `userId` (impersonation). */
  impersonatedById: string | null;
  /** Roles of a « Voir en tant que » view (lib/business/viewAs), if active. */
  viewAsRoles: string | null;
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
  const slug = businessSlugFromPath(path);
  const [session, business] = await Promise.all([
    getAuthSession().catch(() => null),
    slug ? resolveBusinessFromSlug(slug).catch(() => null) : Promise.resolve(null),
  ]);
  return {
    path,
    feature: featureFromPath(path),
    businessId: business?.id ?? null,
    userId: session?.user?.id ?? null,
    impersonatedById: session?.session?.impersonatedBy ?? null,
    viewAsRoles: session?.viewAs?.roles ?? null,
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
  /** Id of the object the action touched (created, updated, deleted…), when known. */
  targetId?: string | null;
  businessId?: string | null;
  /** Tenant slug of the action: resolves the business when `businessId` is not given. */
  businessSlug?: string | null;
  userId?: string | null;
  discordUserId?: string | null;
  source?: 'INTRANET' | 'DISCORD_BOT' | 'SYSTEM';
};

async function resolveBusinessId(input: ActionLogInput, request: RequestLogContext) {
  if (input.businessId) return input.businessId;
  if (input.businessSlug) {
    const business = await resolveBusinessFromSlug(input.businessSlug).catch(() => null);
    if (business) return business.id;
  }
  return request.businessId;
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
      businessId: await resolveBusinessId(input, request),
      userId: input.userId ?? request.userId,
      discordUserId: input.discordUserId ?? (await discordIdForLog(input.userId ?? request.userId)),
      impersonatedById: request.impersonatedById,
      httpStatus: input.httpStatus ?? null,
      durationMs: input.durationMs ?? null,
      path: request.path,
      targetId: input.targetId ?? null,
      // An action made while testing roles says so.
      context: request.viewAsRoles ? { viewAs: request.viewAsRoles, data: input.context } : input.context,
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
  businessId?: string;
  event?: string;
}): void {
  // Read now, inside the action: same object id as its `ACTION` line.
  const targetId = currentActionTargetId();
  writeAppLog(
    resolveRequestLogContext().then(async (request) => ({
      level: 'ERROR' as const,
      kind: 'ERROR' as const,
      feature: (input.feature as LogFeature | undefined) ?? request.feature,
      event: input.event ?? 'action.error',
      outcome: 'failure' as const,
      message: input.message,
      source: 'INTRANET' as const,
      businessId: input.businessId ?? request.businessId,
      userId: request.userId,
      discordUserId: await discordIdForLog(request.userId),
      impersonatedById: request.impersonatedById,
      httpStatus: input.status,
      path: request.path,
      targetId,
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
  businessSlug?: string;
  /** Object id from the result, or from the input only when the action threw (no result). */
  target: (result: ActionResult | undefined) => unknown;
};

/** Never throws: a wrong target rule must not break the action. */
function safeTargetId(meta: LoggedRunMeta, result: ActionResult | undefined): string | null {
  try {
    return toTargetId(meta.target(result));
  } catch {
    return null;
  }
}

async function runLogged<R extends ActionResult>(
  meta: LoggedRunMeta,
  run: () => Promise<R>,
  describe?: (result: R) => { outcome?: LogOutcome; context?: unknown; targetId?: unknown } | undefined,
): Promise<R> {
  const startedAt = Date.now();
  try {
    const result = await runWithActionTarget(safeTargetId(meta, undefined), run);
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
      businessSlug: meta.businessSlug,
      targetId: extra?.targetId === undefined ? safeTargetId(meta, result) : toTargetId(extra.targetId),
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
      businessSlug: meta.businessSlug,
      targetId: safeTargetId(meta, undefined),
      context: { input: meta.context },
      error,
    });
    throw error;
  }
}

/**
 * Runs a server action of a sensitive feature and logs its result: success,
 * refusal (401/403), invalid input (other 4xx) or failure (5xx or exception,
 * rethrown). `describe` adds details from the result (outcome override, context,
 * target id). By default the target is the `id` of `context`, else of the result data.
 */
export async function withLoggedAction<R extends ActionResult>(
  meta: { feature: LogFeature; event: string; label: string; context?: unknown },
  run: () => Promise<R>,
  describe?: (result: R) => { outcome?: LogOutcome; context?: unknown; targetId?: unknown } | undefined,
): Promise<R> {
  return runLogged(
    { ...meta, target: (result) => defaultTargetId(meta.context, result) },
    run,
    describe,
  );
}

/** Features whose actions take the dispensary slug as first argument. */
const NON_TENANT_FEATURES = new Set<LogFeature>(['platform', 'account']);

/**
 * Mutation of any feature: logs every call, whatever the outcome (see
 * docs/APP-LOGS.md). `args` are the action arguments: the first one is the
 * dispensary slug for tenant features, the rest goes to the log context
 * (sanitized). Pass `context` instead when arguments hold secrets or large content.
 * The target id follows `defaultTargetId` (input `id`, string id argument, created
 * `id`); pass `target` when it guesses wrong (see docs/APP-LOGS.md).
 */
export async function loggedAction<A extends unknown[], R extends ActionResult>(
  meta: {
    feature: LogFeature;
    event: string;
    label?: string;
    context?: unknown;
    target?: TargetResolver<A, R>;
  },
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
      businessSlug: tenant ? (args[0] as string) : undefined,
      context: 'context' in meta ? meta.context : tenant ? args.slice(1) : args,
      target: (result) =>
        meta.target ? meta.target(args, result as R | undefined) : defaultTargetId(args[tenant ? 1 : 0], result),
    },
    run,
  );
}
