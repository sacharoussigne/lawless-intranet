import { describe, expect, it } from 'vitest';
import { toggleMarkdownWrap } from './toggleMarkdownWrap';

describe('toggleMarkdownWrap', () => {
  it('wraps a selection with bold markers', () => {
    expect(toggleMarkdownWrap('hello world', 0, 5, '**')).toEqual({
      value: '**hello** world',
      selectionStart: 2,
      selectionEnd: 7,
    });
  });

  it('unwraps bold when selection includes markers', () => {
    expect(toggleMarkdownWrap('**hello** world', 0, 9, '**')).toEqual({
      value: 'hello world',
      selectionStart: 0,
      selectionEnd: 5,
    });
  });

  it('unwraps bold when markers are outside the selection', () => {
    expect(toggleMarkdownWrap('**hello** world', 2, 7, '**')).toEqual({
      value: 'hello world',
      selectionStart: 0,
      selectionEnd: 5,
    });
  });

  it('wraps and unwraps italic without confusing bold', () => {
    const wrapped = toggleMarkdownWrap('hello', 0, 5, '*');
    expect(wrapped).toEqual({
      value: '*hello*',
      selectionStart: 1,
      selectionEnd: 6,
    });

    expect(toggleMarkdownWrap(wrapped.value, 1, 6, '*')).toEqual({
      value: 'hello',
      selectionStart: 0,
      selectionEnd: 5,
    });

    // Bold should stay when toggling italic on inner text of **hello**
    expect(toggleMarkdownWrap('**hello**', 2, 7, '*')).toEqual({
      value: '***hello***',
      selectionStart: 3,
      selectionEnd: 8,
    });
  });

  it('inserts markers when caret is not inside a word', () => {
    expect(toggleMarkdownWrap('hello ', 6, 6, '**')).toEqual({
      value: 'hello ****',
      selectionStart: 8,
      selectionEnd: 8,
    });
  });

  it('expands empty selection to the current word before wrapping', () => {
    expect(toggleMarkdownWrap('say hello there', 6, 6, '**')).toEqual({
      value: 'say **hello** there',
      selectionStart: 6,
      selectionEnd: 11,
    });
  });

  it('unwraps bold around the current word on second Ctrl+B', () => {
    expect(toggleMarkdownWrap('say **hello** there', 8, 8, '**')).toEqual({
      value: 'say hello there',
      selectionStart: 4,
      selectionEnd: 9,
    });
  });
});
