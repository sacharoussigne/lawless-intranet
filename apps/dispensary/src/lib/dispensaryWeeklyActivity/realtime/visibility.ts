import type {
  WeeklyActivityRealtimeEvent,
  WeeklyActivityRealtimeViewerFilter,
} from '@/lib/dispensaryWeeklyActivity/realtime/types';

export function isWeeklyActivityRealtimeVisibleToViewer(
  event: Pick<WeeklyActivityRealtimeEvent, 'ownerUserId' | 'ownerDiscordUserId'>,
  viewer: WeeklyActivityRealtimeViewerFilter,
): boolean {
  if (viewer.canEditAll) {
    return true;
  }

  if (event.ownerUserId && event.ownerUserId === viewer.viewerUserId) {
    return true;
  }

  if (
    event.ownerDiscordUserId &&
    viewer.viewerDiscordUserId &&
    event.ownerDiscordUserId === viewer.viewerDiscordUserId
  ) {
    return true;
  }

  return false;
}
