import { describe, expect, it } from 'vitest';
import { preserveMarkdownBlankLines } from './preserveMarkdownBlankLines';

describe('preserveMarkdownBlankLines', () => {
  it('leaves a single paragraph break unchanged', () => {
    expect(preserveMarkdownBlankLines('a\n\nb')).toBe('a\n\nb');
  });

  it('inserts empty paragraphs for extra blank lines', () => {
    expect(preserveMarkdownBlankLines('a\n\n\nb')).toBe('a\n\n&nbsp;\n\nb');
    expect(preserveMarkdownBlankLines('a\n\n\n\nb')).toBe('a\n\n&nbsp;\n\n&nbsp;\n\nb');
  });

  it('preserves single newlines (handled by remark-breaks later)', () => {
    expect(preserveMarkdownBlankLines('a\nb')).toBe('a\nb');
  });
});
