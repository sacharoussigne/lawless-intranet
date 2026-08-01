import { describe, expect, it } from 'vitest';
import { isWeeklySalesRealtimeVisibleToViewer } from '@/lib/sales/realtime/visibility';

describe('isWeeklySalesRealtimeVisibleToViewer', () => {
  const ownEvent = { ownerUserId: 'user-1' };

  it('allows view_all viewers to see any sale', () => {
    expect(
      isWeeklySalesRealtimeVisibleToViewer(ownEvent, {
        canViewAll: true,
        viewerUserId: 'someone-else',
      }),
    ).toBe(true);
  });

  it('allows owner to see their own sale', () => {
    expect(
      isWeeklySalesRealtimeVisibleToViewer(ownEvent, {
        canViewAll: false,
        viewerUserId: 'user-1',
      }),
    ).toBe(true);
  });

  it('hides teammate sales from employees without view_all', () => {
    expect(
      isWeeklySalesRealtimeVisibleToViewer(ownEvent, {
        canViewAll: false,
        viewerUserId: 'user-2',
      }),
    ).toBe(false);
  });
});
