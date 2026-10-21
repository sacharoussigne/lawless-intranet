import type { KeyboardEvent } from 'react';

export type MarkdownShortcutKind = 'bold' | 'italic';

export type MarkdownShortcutResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

type TextControl = HTMLInputElement | HTMLTextAreaElement;

function isBoldWrapped(value: string, start: number, end: number): boolean {
  return start >= 2 && end + 2 <= value.length && value.slice(start - 2, start) === '**' && value.slice(end, end + 2) === '**';
}

function isItalicWrapped(value: string, start: number, end: number): boolean {
  const open = start >= 1 && value[start - 1] === '*' && (start < 2 || value[start - 2] !== '*');
  const close = end < value.length && value[end] === '*' && (end + 1 >= value.length || value[end + 1] !== '*');
  return open && close;
}

function unwrapMarkers(
  value: string,
  start: number,
  end: number,
  markerLength: number,
): MarkdownShortcutResult {
  const selected = value.slice(start, end);
  const newValue =
    value.slice(0, start - markerLength) + selected + value.slice(end + markerLength);
  return {
    value: newValue,
    selectionStart: start - markerLength,
    selectionEnd: end - markerLength,
  };
}

function unwrapSelectedMarkers(
  value: string,
  start: number,
  end: number,
  markerLength: number,
): MarkdownShortcutResult {
  const selected = value.slice(start, end);
  const inner = selected.slice(markerLength, selected.length - markerLength);
  const newValue = value.slice(0, start) + inner + value.slice(end);
  return {
    value: newValue,
    selectionStart: start,
    selectionEnd: start + inner.length,
  };
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  marker: string,
): MarkdownShortcutResult {
  const selected = value.slice(start, end);
  const newValue = value.slice(0, start) + marker + selected + marker + value.slice(end);
  return {
    value: newValue,
    selectionStart: start + marker.length,
    selectionEnd: end + marker.length,
  };
}

export function applyMarkdownShortcut(
  element: TextControl,
  kind: MarkdownShortcutKind,
): MarkdownShortcutResult {
  const { value, selectionStart, selectionEnd } = element;
  const start = selectionStart ?? 0;
  const end = selectionEnd ?? 0;
  const selected = value.slice(start, end);
  const marker = kind === 'bold' ? '**' : '*';
  const markerLength = marker.length;

  if (kind === 'bold') {
    if (isBoldWrapped(value, start, end)) {
      return unwrapMarkers(value, start, end, markerLength);
    }
    if (
      selected.startsWith('**') &&
      selected.endsWith('**') &&
      selected.length >= 4
    ) {
      return unwrapSelectedMarkers(value, start, end, markerLength);
    }
    return wrapSelection(value, start, end, marker);
  }

  if (isItalicWrapped(value, start, end)) {
    return unwrapMarkers(value, start, end, markerLength);
  }
  if (
    selected.startsWith('*') &&
    selected.endsWith('*') &&
    !selected.startsWith('**') &&
    selected.length >= 2
  ) {
    return unwrapSelectedMarkers(value, start, end, markerLength);
  }
  return wrapSelection(value, start, end, marker);
}

export function tryMarkdownShortcut(
  event: KeyboardEvent<TextControl>,
): MarkdownShortcutResult | null {
  if ((!event.ctrlKey && !event.metaKey) || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key !== 'b' && key !== 'i') {
    return null;
  }

  return applyMarkdownShortcut(event.currentTarget, key === 'b' ? 'bold' : 'italic');
}

export function restoreTextControlSelection(
  element: TextControl,
  selection: Pick<MarkdownShortcutResult, 'selectionStart' | 'selectionEnd'>,
): void {
  requestAnimationFrame(() => {
    element.setSelectionRange(selection.selectionStart, selection.selectionEnd);
  });
}
