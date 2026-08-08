import { describe, expect, it } from 'vitest';
import { REALTIME_DOMAIN } from '@lawless-intranet/realtime';
import { isDispensaryRealtimeVisibleToViewer } from '@/lib/realtime/visibility';

describe('isDispensaryRealtimeVisibleToViewer', () => {
  it('allows agenda when enabled', () => {
    expect(
      isDispensaryRealtimeVisibleToViewer(
        {
          domain: REALTIME_DOMAIN.agenda,
          type: 'todos',
          payload: { agendaId: 'a1' },
        },
        { agenda: true, weeklyActivity: null, sales: null },
      ),
    ).toBe(true);
  });

  it('hides sales without sales filter', () => {
    expect(
      isDispensaryRealtimeVisibleToViewer(
        {
          domain: REALTIME_DOMAIN.sales,
          type: 'weeklySales',
          payload: {
            saleId: 's1',
            ownerUserId: 'u1',
            periodStart: '2026-01-01',
            periodEnd: '2026-01-07',
          },
        },
        { agenda: true, weeklyActivity: null, sales: null },
      ),
    ).toBe(false);
  });

  it('applies weekly activity ownership filter', () => {
    expect(
      isDispensaryRealtimeVisibleToViewer(
        {
          domain: REALTIME_DOMAIN.weeklyActivity,
          type: 'weeklyActivity',
          payload: {
            activityId: 'a1',
            ownerUserId: 'u1',
            ownerDiscordUserId: 'd1',
            periodStart: '2026-01-01',
            periodEnd: '2026-01-07',
          },
        },
        {
          agenda: false,
          weeklyActivity: {
            canEditAll: false,
            viewerUserId: 'u2',
            viewerDiscordUserId: 'd2',
          },
          sales: null,
        },
      ),
    ).toBe(false);
  });
});
