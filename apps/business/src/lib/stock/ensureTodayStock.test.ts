import { describe, expect, it } from 'vitest';
import { getEffectiveStockQuantity } from './ensureTodayStock';

describe('getEffectiveStockQuantity', () => {
  it('prefers today over previous', () => {
    expect(getEffectiveStockQuantity(5, 3)).toBe(5);
  });

  it('falls back to previous when today is null', () => {
    expect(getEffectiveStockQuantity(null, 7)).toBe(7);
  });

  it('returns null when both are missing', () => {
    expect(getEffectiveStockQuantity(null, null)).toBeNull();
    expect(getEffectiveStockQuantity(undefined, undefined)).toBeNull();
  });
});
