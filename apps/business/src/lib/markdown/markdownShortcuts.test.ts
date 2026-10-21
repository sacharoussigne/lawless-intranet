import { describe, expect, it } from 'vitest';
import { applyMarkdownShortcut } from './markdownShortcuts';

function control(value: string, start: number, end: number = start) {
  return {
    value,
    selectionStart: start,
    selectionEnd: end,
  } as HTMLTextAreaElement;
}

describe('applyMarkdownShortcut', () => {
  it('wraps selection in bold markers', () => {
    const el = control('hello world', 6, 11);
    const result = applyMarkdownShortcut(el, 'bold');
    expect(result.value).toBe('hello **world**');
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(13);
  });

  it('unwraps bold when markers surround the selection', () => {
    const el = control('hello **world**', 8, 13);
    const result = applyMarkdownShortcut(el, 'bold');
    expect(result.value).toBe('hello world');
    expect(result.selectionStart).toBe(6);
    expect(result.selectionEnd).toBe(11);
  });

  it('unwraps bold when the selection includes markers', () => {
    const el = control('hello **world**', 6, 15);
    const result = applyMarkdownShortcut(el, 'bold');
    expect(result.value).toBe('hello world');
    expect(result.selectionStart).toBe(6);
    expect(result.selectionEnd).toBe(11);
  });

  it('inserts bold markers around the caret when nothing is selected', () => {
    const el = control('hello', 5);
    const result = applyMarkdownShortcut(el, 'bold');
    expect(result.value).toBe('hello****');
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(7);
  });

  it('wraps selection in italic markers', () => {
    const el = control('hello world', 6, 11);
    const result = applyMarkdownShortcut(el, 'italic');
    expect(result.value).toBe('hello *world*');
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(12);
  });

  it('unwraps italic without touching bold markers', () => {
    const el = control('hello *world*', 7, 12);
    const result = applyMarkdownShortcut(el, 'italic');
    expect(result.value).toBe('hello world');
  });

  it('does not treat bold markers as italic markers', () => {
    const el = control('**bold**', 2, 6);
    const result = applyMarkdownShortcut(el, 'italic');
    expect(result.value).toBe('***bold***');
  });
});
