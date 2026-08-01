import type {
  WeeklySalesRealtimeEvent,
  WeeklySalesRealtimeViewerFilter,
} from '@/lib/sales/realtime/types';

export function isWeeklySalesRealtimeVisibleToViewer(
  event: Pick<WeeklySalesRealtimeEvent, 'ownerUserId'>,
  viewer: WeeklySalesRealtimeViewerFilter,
): boolean {
  if (viewer.canViewAll) {
    return true;
  }

  return event.ownerUserId === viewer.viewerUserId;
}
