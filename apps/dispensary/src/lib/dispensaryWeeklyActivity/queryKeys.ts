export type WeeklyActivityWeekBounds = {
  periodStart: Date | string;
  periodEnd: Date | string;
};

export function normalizeWeeklyActivityWeekBounds(
  bounds: WeeklyActivityWeekBounds,
): { periodStart: Date; periodEnd: Date } {
  return {
    periodStart:
      bounds.periodStart instanceof Date
        ? bounds.periodStart
        : new Date(bounds.periodStart),
    periodEnd:
      bounds.periodEnd instanceof Date ? bounds.periodEnd : new Date(bounds.periodEnd),
  };
}

export function weeklyActivityWeekKey(bounds: WeeklyActivityWeekBounds): string {
  const normalized = normalizeWeeklyActivityWeekBounds(bounds);
  return `${normalized.periodStart.toISOString()}__${normalized.periodEnd.toISOString()}`;
}

export function isSameWeeklyActivityWeek(
  a: WeeklyActivityWeekBounds,
  b: WeeklyActivityWeekBounds,
): boolean {
  const normA = normalizeWeeklyActivityWeekBounds(a);
  const normB = normalizeWeeklyActivityWeekBounds(b);
  return (
    normA.periodStart.getTime() === normB.periodStart.getTime() &&
    normA.periodEnd.getTime() === normB.periodEnd.getTime()
  );
}
