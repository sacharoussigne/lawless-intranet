import { describe, expect, it } from 'vitest';
import { MAX_CONTEXT_LENGTH, sanitizeLogContext, serializeError } from './sanitize';

describe('sanitizeLogContext', () => {
  it('masks secret keys at any depth', () => {
    expect(
      sanitizeLogContext({
        password: 'p',
        nested: { accessToken: 't', Authorization: 'Bearer x', name: 'ok' },
        list: [{ cookie: 'c' }],
      }),
    ).toEqual({
      password: '[masqué]',
      nested: { accessToken: '[masqué]', Authorization: '[masqué]', name: 'ok' },
      list: [{ cookie: '[masqué]' }],
    });
  });

  it('keeps dates and primitives JSON-safe', () => {
    expect(sanitizeLogContext({ at: new Date('2026-10-15T10:00:00.000Z'), n: 1, b: true, x: null })).toEqual({
      at: '2026-10-15T10:00:00.000Z',
      n: 1,
      b: true,
      x: null,
    });
  });

  it('cuts long strings and long arrays', () => {
    const result = sanitizeLogContext({ text: 'a'.repeat(3_000), items: Array.from({ length: 60 }, (_, i) => i) }) as {
      text: string;
      items: unknown[];
    };
    expect(result.text.length).toBeLessThan(2_100);
    expect(result.items).toHaveLength(51);
  });

  it('replaces an oversized context by a truncated preview', () => {
    const big = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, 'v'.repeat(1_000)]));
    const result = sanitizeLogContext(big) as { truncated: boolean; preview: string };
    expect(result.truncated).toBe(true);
    expect(result.preview.length).toBe(MAX_CONTEXT_LENGTH);
  });
});

describe('serializeError', () => {
  it('keeps name, message and stack of an Error', () => {
    const serialized = serializeError(new TypeError('boom'));
    expect(serialized.name).toBe('TypeError');
    expect(serialized.message).toBe('boom');
    expect(serialized.stack).toContain('boom');
  });

  it('keeps the cause and its code (fetch failed → ECONNREFUSED)', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3001'), { code: 'ECONNREFUSED' });
    const serialized = serializeError(new TypeError('fetch failed', { cause }));
    expect(serialized.cause?.code).toBe('ECONNREFUSED');
    expect(serialized.cause?.message).toContain('3001');
  });

  it('handles thrown non-errors', () => {
    expect(serializeError('nope')).toEqual({ name: 'NonError', message: 'nope' });
  });
});
