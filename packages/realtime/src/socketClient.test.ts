import { describe, expect, it } from 'vitest';
import { computeReconnectDelay } from './socketClient';

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
