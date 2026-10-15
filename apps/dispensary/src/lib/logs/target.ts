import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Id of the object a mutation touched, stored in `app_logs.targetId` so that
 * `/platform/logs` can show the whole history of one object (see docs/APP-LOGS.md).
 */

/** Result of a server action, as seen by the target rules. Missing when the action threw. */
type TargetResult = { data?: unknown } | undefined;

/**
 * Explicit target of an action, when the default rules guess wrong. `args` are
 * all the action arguments (slug included); `result` is missing when the action threw.
 */
export type TargetResolver<A extends unknown[], R> = (args: A, result: R | undefined) => unknown;

const MAX_TARGET_ID_LENGTH = 200;

/** A non-empty, reasonably short string, else null. */
export function toTargetId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TARGET_ID_LENGTH
    ? value
    : null;
}

function idOf(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof FormData !== 'undefined' && value instanceof FormData) return null;
  return toTargetId((value as { id?: unknown }).id);
}

/**
 * Default rules, in order: the input object's `id` (`data: { id }`), a string
 * argument (`id: string`, `saleId: string`), then the `id` of the result data
 * (creations). `input` is the first argument after the dispensary slug.
 */
export function defaultTargetId(input: unknown, result: TargetResult): string | null {
  return idOf(input) ?? toTargetId(input) ?? idOf(result?.data);
}

/**
 * Target known before the action runs (from its input), read by the automatic
 * server error log so that the `ERROR` line carries the same id as the `ACTION` line.
 */
const actionTargetScope = new AsyncLocalStorage<{ targetId: string | null }>();

export function runWithActionTarget<T>(targetId: string | null, run: () => T): T {
  return actionTargetScope.run({ targetId }, run);
}

export function currentActionTargetId(): string | null {
  return actionTargetScope.getStore()?.targetId ?? null;
}
