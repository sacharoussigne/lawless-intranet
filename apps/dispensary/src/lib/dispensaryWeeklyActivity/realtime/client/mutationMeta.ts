import { realtimeMutationMeta } from '@lawless-intranet/realtime';
import type { WeeklyActivityMutationMeta } from '@/lib/dispensaryWeeklyActivity/realtime/types';

export function weeklyActivityMutationMeta(
  clientId: string | null | undefined,
): WeeklyActivityMutationMeta | undefined {
  return realtimeMutationMeta(clientId);
}
