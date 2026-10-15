import { describe, expect, it } from 'vitest';
import { currentActionTargetId, defaultTargetId, runWithActionTarget, toTargetId } from './target';

describe('defaultTargetId', () => {
  it('takes the id of the input object (update, delete)', () => {
    expect(defaultTargetId({ id: 'company-1', name: 'Acme' }, { data: { success: true } })).toBe('company-1');
  });

  it('takes a string argument (positional id)', () => {
    expect(defaultTargetId('sale-1', { data: { success: true } })).toBe('sale-1');
  });

  it('prefers the input id over the result id', () => {
    expect(defaultTargetId({ id: 'input-id' }, { data: { id: 'result-id' } })).toBe('input-id');
  });

  it('takes the created id from the result (creation)', () => {
    expect(defaultTargetId({ name: 'Acme' }, { data: { id: 'company-2', name: 'Acme' } })).toBe('company-2');
  });

  it('keeps the input id when the action threw (no result)', () => {
    expect(defaultTargetId({ id: 'company-1' }, undefined)).toBe('company-1');
  });

  it('is null for a failed creation, a bulk input or a list result', () => {
    expect(defaultTargetId({ name: 'Acme' }, { data: undefined })).toBeNull();
    expect(defaultTargetId({ items: [{ id: 'a' }, { id: 'b' }] }, { data: [{ id: 'a' }] })).toBeNull();
    expect(defaultTargetId([{ itemId: 'a' }], undefined)).toBeNull();
    expect(defaultTargetId(undefined, undefined)).toBeNull();
  });

  it('ignores non-string ids and FormData', () => {
    expect(defaultTargetId({ id: 42 }, undefined)).toBeNull();
    const formData = new FormData();
    formData.set('id', 'x');
    expect(defaultTargetId(formData, undefined)).toBeNull();
  });
});

describe('toTargetId', () => {
  it('accepts short non-empty strings only', () => {
    expect(toTargetId('abc')).toBe('abc');
    expect(toTargetId('')).toBeNull();
    expect(toTargetId('x'.repeat(201))).toBeNull();
    expect(toTargetId(null)).toBeNull();
  });
});

describe('action target scope', () => {
  it('exposes the target inside the action, including after an await', async () => {
    expect(currentActionTargetId()).toBeNull();
    const seen = await runWithActionTarget('sale-1', async () => {
      await Promise.resolve();
      return currentActionTargetId();
    });
    expect(seen).toBe('sale-1');
    expect(currentActionTargetId()).toBeNull();
  });
});
