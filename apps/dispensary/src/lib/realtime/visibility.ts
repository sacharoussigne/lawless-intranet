import type { RealtimeEnvelope } from '@lawless-intranet/realtime';
import { REALTIME_DOMAIN } from '@lawless-intranet/realtime';
import { isWeeklyActivityRealtimeVisibleToViewer } from '@/lib/dispensaryWeeklyActivity/realtime/visibility';
import type { DispensaryRealtimeViewerFilter } from '@/lib/realtime/types';

export function isDispensaryRealtimeVisibleToViewer(
  event: RealtimeEnvelope,
  filter: DispensaryRealtimeViewerFilter,
): boolean {
  if (event.domain === REALTIME_DOMAIN.weeklyActivity) {
    if (!filter.weeklyActivity) return false;
    const payload = event.payload as {
      ownerUserId: string | null;
      ownerDiscordUserId: string;
    };
    return isWeeklyActivityRealtimeVisibleToViewer(payload, filter.weeklyActivity);
  }

  return false;
}
