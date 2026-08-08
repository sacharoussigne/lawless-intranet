import type { WeeklyActivityRealtimeViewerFilter } from '@/lib/dispensaryWeeklyActivity/realtime/types';
import type { WeeklySalesRealtimeViewerFilter } from '@/lib/sales/realtime/types';

export type DispensaryRealtimeViewerFilter = {
  agenda: boolean;
  weeklyActivity: WeeklyActivityRealtimeViewerFilter | null;
  sales: WeeklySalesRealtimeViewerFilter | null;
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
