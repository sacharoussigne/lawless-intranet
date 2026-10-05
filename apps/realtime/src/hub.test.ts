import { describe, expect, it } from 'vitest';
import type { RealtimeEnvelope } from '@lawless-intranet/realtime';
import { RealtimeHub, type HubConnection } from './hub';

const envelope: RealtimeEnvelope = { domain: 'agenda', type: 'events', payload: {} };

function connection(userId: string) {
  const received: string[] = [];
  const conn: HubConnection = {
    id: `${userId}-${Math.random()}`,
    userId,
    topics: new Set(),
    deliver: (topic) => received.push(topic),
  };
  return { conn, received };
}

describe('RealtimeHub', () => {
  it('delivers only to connections subscribed to the topics', () => {
    const hub = new RealtimeHub();
    const a = connection('u1');
    const b = connection('u2');
    hub.setTopics(a.conn, ['agenda:a1']);
    hub.setTopics(b.conn, ['agenda:a2']);

    expect(hub.publish(['agenda:a1'], envelope)).toBe(1);
    expect(a.received).toEqual(['agenda:a1']);
    expect(b.received).toEqual([]);
  });

  it('delivers once per connection even when several topics match', () => {
    const hub = new RealtimeHub();
    const a = connection('u1');
    hub.setTopics(a.conn, ['agenda:a1', 'user:u1']);

    expect(hub.publish(['agenda:a1', 'user:u1'], envelope)).toBe(1);
    expect(a.received).toHaveLength(1);
  });

  it('replaces topics on re-auth', () => {
    const hub = new RealtimeHub();
    const a = connection('u1');
    hub.setTopics(a.conn, ['agenda:a1']);
    hub.setTopics(a.conn, ['agenda:a2']);

    expect(hub.publish(['agenda:a1'], envelope)).toBe(0);
    expect(hub.publish(['agenda:a2'], envelope)).toBe(1);
  });

  it('revokes topics for every connection of a user', () => {
    const hub = new RealtimeHub();
    const tab1 = connection('u1');
    const tab2 = connection('u1');
    const other = connection('u2');
    hub.setTopics(tab1.conn, ['agenda:a1', 'user:u1']);
    hub.setTopics(tab2.conn, ['agenda:a1']);
    hub.setTopics(other.conn, ['agenda:a1']);

    expect(hub.revoke('u1', ['agenda:a1'])).toBe(2);
    expect(hub.publish(['agenda:a1'], envelope)).toBe(1);
    expect(other.received).toEqual(['agenda:a1']);
    expect(hub.publish(['user:u1'], envelope)).toBe(1);
  });

  it('cleans up removed connections', () => {
    const hub = new RealtimeHub();
    const a = connection('u1');
    hub.setTopics(a.conn, ['agenda:a1']);
    hub.remove(a.conn);

    expect(hub.publish(['agenda:a1'], envelope)).toBe(0);
    expect(hub.stats()).toEqual({ connections: 0, users: 0, topics: 0 });
  });
});
