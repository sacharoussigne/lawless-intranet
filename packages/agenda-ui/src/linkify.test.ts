import { describe, expect, it } from 'vitest';
import { splitLinks } from './linkify';

describe('splitLinks', () => {
  it('keeps a text without link as is', () => {
    expect(splitLinks('Acheter du pain')).toEqual([{ type: 'text', value: 'Acheter du pain' }]);
  });

  it('finds several links between texts', () => {
    expect(splitLinks('voir https://a.com/x et http://b.fr?q=1 vite')).toEqual([
      { type: 'text', value: 'voir ' },
      { type: 'link', value: 'https://a.com/x', href: 'https://a.com/x' },
      { type: 'text', value: ' et ' },
      { type: 'link', value: 'http://b.fr?q=1', href: 'http://b.fr?q=1' },
      { type: 'text', value: ' vite' },
    ]);
  });

  it('leaves the sentence punctuation out of the link', () => {
    expect(splitLinks('voir https://a.com/x.')).toEqual([
      { type: 'text', value: 'voir ' },
      { type: 'link', value: 'https://a.com/x', href: 'https://a.com/x' },
      { type: 'text', value: '.' },
    ]);
  });

  it('links www. addresses over https', () => {
    expect(splitLinks('www.example.com')).toEqual([
      { type: 'link', value: 'www.example.com', href: 'https://www.example.com' },
    ]);
  });

  it('drops an unmatched closing parenthesis but keeps a matched one', () => {
    expect(splitLinks('(https://a.com/x)')[1]).toEqual({ type: 'link', value: 'https://a.com/x', href: 'https://a.com/x' });
    expect(splitLinks('https://fr.wikipedia.org/wiki/Foo_(bar)')[0]).toMatchObject({
      value: 'https://fr.wikipedia.org/wiki/Foo_(bar)',
    });
  });

  it('never links another scheme', () => {
    expect(splitLinks('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }]);
  });
});
