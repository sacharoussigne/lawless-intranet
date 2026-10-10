import type { WeeklyActivityRealtimeViewerFilter } from '@/lib/dispensaryWeeklyActivity/realtime/types';

export type DispensaryRealtimeViewerFilter = {
  weeklyActivity: WeeklyActivityRealtimeViewerFilter | null;
};

export type DispensaryRealtimePublishBody = {
  dispensaryId: string;
  envelope: {
    domain: string;
    type: string;
    originClientId?: string;
    payload: unknown;
  };
};
