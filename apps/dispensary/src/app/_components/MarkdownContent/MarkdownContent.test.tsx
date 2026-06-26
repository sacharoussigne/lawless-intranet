import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./MarkdownContent.module.scss', () => ({
  default: { root: 'markdown-root' },
}));

import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
  it('returns null for empty source', () => {
    expect(renderToStaticMarkup(<MarkdownContent source="" />)).toBe('');
    expect(renderToStaticMarkup(<MarkdownContent source="   " />)).toBe('');
  });

  it('renders bold text with trailing space inside markers', () => {
    const html = renderToStaticMarkup(<MarkdownContent source="**Quelques **" />);
    expect(html).toContain('<strong>Quelques</strong>');
  });

  it('renders bold text', () => {
    const html = renderToStaticMarkup(<MarkdownContent source="**gras**" />);
    expect(html).toContain('<strong>gras</strong>');
  });

  it('renders a link', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent source="[exemple](https://example.com)" />,
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('exemple');
  });

  it('renders a bullet list', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent source={`- un
- deux`} />,
    );
    expect(html).toContain('<ul>');
    expect(html).toContain('un');
    expect(html).toContain('deux');
  });

  it('strips unsafe HTML', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent source={'**Texte** <script>alert("xss")</script>'} />,
    );
    expect(html).not.toContain('<script');
    expect(html).toContain('<strong>Texte</strong>');
  });
});
