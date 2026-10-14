import { describe, expect, it } from 'vitest';
import { computeReconnectDelay, shouldResyncOnReady } from './socketClient';

describe('computeReconnectDelay', () => {
  it('grows exponentially with jitter between half and full delay', () => {
    expect(computeReconnectDelay(0, () => 0)).toBe(500);
    expect(computeReconnectDelay(0, () => 1)).toBe(1_000);
    expect(computeReconnectDelay(3, () => 0)).toBe(4_000);
    expect(computeReconnectDelay(3, () => 1)).toBe(8_000);
  });

  it('is capped at 30 seconds', () => {
    expect(computeReconnectDelay(20, () => 1)).toBe(30_000);
  });
});

describe('shouldResyncOnReady', () => {
  it('does not resync after a token refresh on the same connection', () => {
    expect(
      shouldResyncOnReady({ firstOnSocket: false, firstConnection: false, sinceMountMs: 600_000 }),
    ).toBe(false);
    expect(
      shouldResyncOnReady({ firstOnSocket: false, firstConnection: true, sinceMountMs: 600_000 }),
    ).toBe(false);
  });

  it('resyncs after a reconnection', () => {
    expect(
      shouldResyncOnReady({ firstOnSocket: true, firstConnection: false, sinceMountMs: 1_000 }),
    ).toBe(true);
  });

  it('skips the first connection right after the page render, not a late one', () => {
    expect(
      shouldResyncOnReady({ firstOnSocket: true, firstConnection: true, sinceMountMs: 1_000 }),
    ).toBe(false);
    expect(
      shouldResyncOnReady({ firstOnSocket: true, firstConnection: true, sinceMountMs: 10_000 }),
    ).toBe(true);
  });
});
