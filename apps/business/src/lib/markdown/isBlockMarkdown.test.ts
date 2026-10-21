import { describe, expect, it } from 'vitest';
import { isBlockMarkdown } from './isBlockMarkdown';

describe('isBlockMarkdown', () => {
  it('returns false for plain single-line text', () => {
    expect(isBlockMarkdown('Quelques semaines après le début de la grossesse')).toBe(false);
  });

  it('returns false for inline emphasis', () => {
    expect(isBlockMarkdown('**gras** et *italique*')).toBe(false);
  });

  it('returns true for multiline text', () => {
    expect(isBlockMarkdown('ligne un\nligne deux')).toBe(true);
  });

  it('returns true for headings and lists', () => {
    expect(isBlockMarkdown('# Titre')).toBe(true);
    expect(isBlockMarkdown('- item')).toBe(true);
  });

  it('returns true for images', () => {
    expect(isBlockMarkdown('![x](https://example.com/a.png)')).toBe(true);
  });
});
