/** Whether a remote fetch started at `epochAtStart` may still apply. */
export function shouldApplyRemoteLists(
  epochAtStart: number,
  currentEpoch: number,
): boolean {
  return epochAtStart === currentEpoch;
}

/** Compare ISO/Date timestamps for optimistic concurrency (ms precision). */
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
