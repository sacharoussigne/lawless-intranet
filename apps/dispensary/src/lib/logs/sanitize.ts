/** Keys never written to a log, at any depth (case-insensitive substring match). */
const SECRET_KEY_PATTERN = /password|secret|token|authorization|cookie|api[-_]?key/i;
const MAX_STRING_LENGTH = 2_000;
const MAX_ARRAY_ITEMS = 50;
const MAX_DEPTH = 6;
const MAX_STACK_LENGTH = 4_000;
/** Above this size (JSON characters), the context is replaced by a truncated preview. */
export const MAX_CONTEXT_LENGTH = 16_000;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}… (${value.length - max} car. coupés)` : value;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return truncate(value, MAX_STRING_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[trop profond]';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`… ${value.length - MAX_ARRAY_ITEMS} éléments de plus`);
    return items;
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SECRET_KEY_PATTERN.test(key) ? '[masqué]' : sanitizeValue(item, depth + 1);
    }
    return result;
  }
  return String(value);
}

/** JSON-safe copy of a log context: secrets masked, long strings and arrays cut, size capped. */
export function sanitizeLogContext(value: unknown): unknown {
  if (value === undefined) return undefined;
  const sanitized = sanitizeValue(value, 0);
  const json = JSON.stringify(sanitized);
  if (json.length <= MAX_CONTEXT_LENGTH) return sanitized;
  return { truncated: true, preview: json.slice(0, MAX_CONTEXT_LENGTH) };
}

export type SerializedError = {
  name: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: SerializedError;
};

/**
 * `{ name, message, code, stack, cause }` of a thrown value, stack cut. The cause
 * matters: `fetch failed` only says why (ECONNREFUSED, timeout…) in its cause.
 */
export function serializeError(error: unknown, depth = 0): SerializedError {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const cause = (error as { cause?: unknown }).cause;
    return {
      name: error.name,
      message: truncate(error.message, MAX_STRING_LENGTH),
      ...(typeof code === 'string' ? { code } : {}),
      ...(error.stack ? { stack: truncate(error.stack, MAX_STACK_LENGTH) } : {}),
      ...(cause !== undefined && depth < 3 ? { cause: serializeError(cause, depth + 1) } : {}),
    };
  }
  return { name: 'NonError', message: truncate(String(error), MAX_STRING_LENGTH) };
}
