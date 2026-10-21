import { describe, expect, it } from 'vitest';
import { nextOrderStatus, orderStatusStepIndex } from './statusSteps';

describe('statusSteps', () => {
  it('walks the path up to Completed', () => {
    expect(nextOrderStatus('DRAFT')).toBe('LETTER_SENT');
    expect(nextOrderStatus('READY')).toBe('COMPLETED');
    expect(nextOrderStatus('COMPLETED')).toBeNull();
  });

  it('keeps a cancelled order off the path', () => {
    expect(orderStatusStepIndex('CANCELLED')).toBe(-1);
    expect(nextOrderStatus('CANCELLED')).toBeNull();
  });
});
