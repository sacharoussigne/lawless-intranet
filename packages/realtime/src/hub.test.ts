import { describe, expect, it } from 'vitest';
import { createRealtimeHub } from './hub';

describe('createRealtimeHub', () => {
  it('broadcasts to subscribers on the same channel', () => {
    const hub = createRealtimeHub<{ value: number }>({
      globalKey: `__testHub_${Math.random()}`,
    });
    const received: string[] = [];

    const unsubscribe = hub.subscribe('channel-a', (chunk) => {
      received.push(chunk);
    });

    hub.broadcast('channel-a', { value: 1 });
    hub.broadcast('channel-b', { value: 2 });

    expect(received).toHaveLength(1);
    expect(received[0]).toContain('"value":1');
    expect(hub.subscriberCount('channel-a')).toBe(1);

    unsubscribe();
    expect(hub.subscriberCount('channel-a')).toBe(0);
  });

  it('filters events with isVisible', () => {
    const hub = createRealtimeHub<{ ownerId: string }, { viewerId: string }>({
      globalKey: `__testHubFilter_${Math.random()}`,
      isVisible: (event, filter) => event.ownerId === filter.viewerId,
    });
    const received: string[] = [];

    hub.subscribe(
      'channel',
      (chunk) => {
        received.push(chunk);
      },
      { viewerId: 'user-1' },
    );

    hub.broadcast('channel', { ownerId: 'user-2' });
    hub.broadcast('channel', { ownerId: 'user-1' });

    expect(received).toHaveLength(1);
  });
});
