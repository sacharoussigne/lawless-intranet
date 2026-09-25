/** Compare expected vs actual updatedAt for optimistic concurrency. */
export function todoUpdatedAtMatches(
  expected: Date | string | null | undefined,
  actual: Date | string | null | undefined,
): boolean {
  if (expected == null || actual == null) return false;
  const expectedMs = new Date(expected).getTime();
  const actualMs = new Date(actual).getTime();
  if (!Number.isFinite(expectedMs) || !Number.isFinite(actualMs)) return false;
  return expectedMs === actualMs;
}
