import { describe, expect, it } from 'vitest';
import { decodeReadPayload, encodeReadPayload } from './read';

describe('read payload', () => {
  it('round-trips dates, nested and in arrays', () => {
    const value = {
      status: 200,
      data: [{ id: 'a', createdAt: new Date('2026-10-15T10:00:00.000Z'), note: '2026-10-15T10:00:00.000Z' }],
      period: { start: new Date('2026-10-12T00:00:00.000Z') },
    };
    const decoded = decodeReadPayload(encodeReadPayload(value)) as typeof value;

    expect(decoded.data[0].createdAt).toBeInstanceOf(Date);
    expect(decoded.data[0].createdAt.toISOString()).toBe('2026-10-15T10:00:00.000Z');
    // A string that looks like a date stays a string.
    expect(decoded.data[0].note).toBe('2026-10-15T10:00:00.000Z');
    expect(decoded.period.start).toBeInstanceOf(Date);
  });

  it('keeps plain values untouched', () => {
    const value = { status: 404, error: 'Introuvable', list: [1, null, 'x'], nested: { $date: 1 } };
    expect(decodeReadPayload(encodeReadPayload(value))).toEqual(value);
  });
});
