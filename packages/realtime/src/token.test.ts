import { describe, expect, it } from 'vitest';
import { signRealtimeToken, verifyRealtimeToken } from './token';
import { isValidRealtimeTopic, realtimeTopics } from './topics';

const SECRET = 'test-secret';

describe('realtime token', () => {
  it('round-trips user and topics', () => {
    const { token, expiresAt } = signRealtimeToken(
      { userId: 'user-1', topics: [realtimeTopics.agenda('a1'), realtimeTopics.user('user-1')], now: 1_000, ttlMs: 60_000 },
      SECRET,
    );
    expect(expiresAt).toBe(61_000);

    const result = verifyRealtimeToken(token, SECRET, 2_000);
    expect(result).toEqual({
      ok: true,
      payload: { sub: 'user-1', topics: ['agenda:a1', 'user:user-1'], exp: 61_000 },
    });
  });

  it('rejects a token signed with another secret', () => {
    const { token } = signRealtimeToken({ userId: 'u', topics: [] }, SECRET);
    expect(verifyRealtimeToken(token, 'other-secret')).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a tampered payload', () => {
    const { token } = signRealtimeToken({ userId: 'u', topics: ['agenda:a1'] }, SECRET);
    const [version, , signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'u', topics: ['agenda:a2'], exp: Date.now() + 60_000 }),
    ).toString('base64url');
    expect(verifyRealtimeToken(`${version}.${forged}.${signature}`, SECRET)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects an expired token', () => {
    const { token } = signRealtimeToken({ userId: 'u', topics: [], now: 0, ttlMs: 10 }, SECRET);
    expect(verifyRealtimeToken(token, SECRET, 10)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects malformed tokens', () => {
    expect(verifyRealtimeToken('nope', SECRET)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyRealtimeToken('v1.a.b', '')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('drops invalid topics when signing', () => {
    const { token } = signRealtimeToken({ userId: 'u', topics: ['agenda:a1', 'bad topic', 'agenda:a1'] }, SECRET);
    const result = verifyRealtimeToken(token, SECRET);
    expect(result.ok && result.payload.topics).toEqual(['agenda:a1']);
  });
});

describe('realtime topics', () => {
  it('builds and validates topic names', () => {
    expect(realtimeTopics.agendas('dispensary', 'd1')).toBe('agendas:dispensary:d1');
    expect(realtimeTopics.media('shelter', 's1')).toBe('media:shelter:s1');
    expect(isValidRealtimeTopic('agenda:3f2a-b1')).toBe(true);
    expect(isValidRealtimeTopic('agenda')).toBe(false);
    expect(isValidRealtimeTopic('agenda:a b')).toBe(false);
    expect(isValidRealtimeTopic(42)).toBe(false);
  });
});
