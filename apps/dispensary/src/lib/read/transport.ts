/**
 * JSON for the GET read routes, keeping `Date`s (server actions preserve them,
 * plain JSON would turn them into strings). Dates travel as `{ "$date": iso }`.
 */

const DATE_TAG = '$date';

export function encodeReadPayload(value: unknown): string {
  return JSON.stringify(value, function replacer(this: Record<string, unknown>, key, current: unknown) {
    // `current` is already `toJSON()`-ed; the original value is still on the holder.
    const raw = this[key];
    return raw instanceof Date ? { [DATE_TAG]: raw.toISOString() } : current;
  });
}

export function decodeReadPayload(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);
      const tagged = (value as Record<string, unknown>)[DATE_TAG];
      if (keys.length === 1 && typeof tagged === 'string') return new Date(tagged);
    }
    return value;
  });
}
