import { describe, expect, it } from 'vitest';
import { normalizeMarkdownEmphasis } from './normalizeMarkdownEmphasis';

describe('normalizeMarkdownEmphasis', () => {
  it('trims trailing space inside bold markers', () => {
    expect(normalizeMarkdownEmphasis('**Quelques **')).toBe('**Quelques**');
  });

  it('trims leading space inside bold markers', () => {
    expect(normalizeMarkdownEmphasis('** Quelques**')).toBe('**Quelques**');
  });

  it('keeps internal spaces', () => {
    expect(normalizeMarkdownEmphasis('**hello world**')).toBe('**hello world**');
  });

  it('trims spaces inside italic markers', () => {
    expect(normalizeMarkdownEmphasis('*italique *')).toBe('*italique*');
  });

  it('leaves already valid emphasis unchanged', () => {
    expect(normalizeMarkdownEmphasis('**Quelques**')).toBe('**Quelques**');
  });
});
