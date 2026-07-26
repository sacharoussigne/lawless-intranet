import { describe, expect, it } from 'vitest';
import { isWeeklyActivityRealtimeVisibleToViewer } from '@/lib/dispensaryWeeklyActivity/realtime/visibility';

describe('isWeeklyActivityRealtimeVisibleToViewer', () => {
  const ownEvent = {
    ownerUserId: 'user-1',
    ownerDiscordUserId: 'discord-1',
  };

  it('allows edit_all viewers to see any activity', () => {
    expect(
      isWeeklyActivityRealtimeVisibleToViewer(ownEvent, {
        canEditAll: true,
        viewerUserId: 'someone-else',
        viewerDiscordUserId: 'discord-other',
      }),
    ).toBe(true);
  });

  it('allows owner matched by userId', () => {
    expect(
      isWeeklyActivityRealtimeVisibleToViewer(ownEvent, {
        canEditAll: false,
        viewerUserId: 'user-1',
        viewerDiscordUserId: null,
      }),
    ).toBe(true);
  });

  it('allows owner matched by discord id', () => {
    expect(
      isWeeklyActivityRealtimeVisibleToViewer(
        { ownerUserId: null, ownerDiscordUserId: 'discord-1' },
        {
          canEditAll: false,
          viewerUserId: 'user-1',
          viewerDiscordUserId: 'discord-1',
        },
      ),
    ).toBe(true);
  });

  it('hides teammate activity from employees without edit_all', () => {
    expect(
      isWeeklyActivityRealtimeVisibleToViewer(ownEvent, {
        canEditAll: false,
        viewerUserId: 'user-2',
        viewerDiscordUserId: 'discord-2',
      }),
    ).toBe(false);
  });
});
