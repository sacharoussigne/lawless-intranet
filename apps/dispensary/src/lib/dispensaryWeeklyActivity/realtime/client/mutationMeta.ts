import type { WeeklyActivityMutationMeta } from '@/lib/dispensaryWeeklyActivity/realtime/types';

export function weeklyActivityMutationMeta(
  clientId: string | null | undefined,
): WeeklyActivityMutationMeta | undefined {
  if (!clientId) {
    return undefined;
  }
  return { originClientId: clientId };
}
