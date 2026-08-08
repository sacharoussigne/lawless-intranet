import type { RealtimeEnvelope } from '@lawless-intranet/realtime';
import { REALTIME_DOMAIN } from '@lawless-intranet/realtime';
import { isWeeklyActivityRealtimeVisibleToViewer } from '@/lib/dispensaryWeeklyActivity/realtime/visibility';
import type { DispensaryRealtimeViewerFilter } from '@/lib/realtime/types';
import { isWeeklySalesRealtimeVisibleToViewer } from '@/lib/sales/realtime/visibility';

export function isDispensaryRealtimeVisibleToViewer(
  event: RealtimeEnvelope,
  filter: DispensaryRealtimeViewerFilter,
): boolean {
  if (event.domain === REALTIME_DOMAIN.agenda) {
    return filter.agenda;
  }

  if (event.domain === REALTIME_DOMAIN.weeklyActivity) {
    if (!filter.weeklyActivity) return false;
    const payload = event.payload as {
      ownerUserId: string | null;
      ownerDiscordUserId: string;
    };
    return isWeeklyActivityRealtimeVisibleToViewer(payload, filter.weeklyActivity);
  }

  if (event.domain === REALTIME_DOMAIN.sales) {
    if (!filter.sales) return false;
    const payload = event.payload as { ownerUserId: string };
    return isWeeklySalesRealtimeVisibleToViewer(payload, filter.sales);
  }

  return false;
}
