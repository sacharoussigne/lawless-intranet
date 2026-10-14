import { describe, expect, it, vi } from 'vitest';
import { createSessionCache, readSessionCookieKey } from './sessionCache';

describe('readSessionCookieKey', () => {
  it('reads the session cookie among others', () => {
    expect(readSessionCookieKey('disp-theme=nuit; lawless-intranet.session_token=abc.def; x=1')).toBe(
      'abc.def',
    );
  });

  it('reads the secure cookie', () => {
    expect(readSessionCookieKey('__Secure-lawless-intranet.session_token=tok')).toBe('tok');
  });

  it('returns null without a session cookie', () => {
    expect(readSessionCookieKey('disp-theme=nuit')).toBeNull();
    expect(readSessionCookieKey(null)).toBeNull();
    expect(readSessionCookieKey('other-lawless-intranet.session_token=x')).toBeNull();
  });
});

describe('createSessionCache', () => {
  it('reuses a valid session until it expires', async () => {
    let time = 0;
    const cache = createSessionCache<string>({ ttlMs: 15_000, maxEntries: 10, now: () => time });
    const load = vi.fn(async () => 'session');

    expect(await cache.get('k', load)).toBe('session');
    time = 14_999;
    expect(await cache.get('k', load)).toBe('session');
    expect(load).toHaveBeenCalledTimes(1);

    time = 15_000;
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent lookups', async () => {
    const cache = createSessionCache<string>({ ttlMs: 15_000, maxEntries: 10 });
    const load = vi.fn(async () => 'session');

    const results = await Promise.all([cache.get('k', load), cache.get('k', load), cache.get('k', load)]);
    expect(results).toEqual(['session', 'session', 'session']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never caches a missing session', async () => {
    const cache = createSessionCache<string>({ ttlMs: 15_000, maxEntries: 10 });
    const load = vi.fn(async () => null);

    await cache.get('k', load);
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed lookup', async () => {
    const cache = createSessionCache<string>({ ttlMs: 15_000, maxEntries: 10 });
    const failing = vi.fn(async () => {
      throw new Error('down');
    });

    await expect(cache.get('k', failing)).rejects.toThrow('down');
    const load = vi.fn(async () => 'session');
    expect(await cache.get('k', load)).toBe('session');
  });

  it('drops the oldest entries beyond the limit', async () => {
    const cache = createSessionCache<string>({ ttlMs: 15_000, maxEntries: 2 });
    await cache.get('a', async () => 'A');
    await cache.get('b', async () => 'B');
    await cache.get('c', async () => 'C');

    const load = vi.fn(async () => 'A2');
    expect(await cache.get('a', load)).toBe('A2');
    expect(load).toHaveBeenCalledTimes(1);
  });
});
