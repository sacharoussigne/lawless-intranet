export type ToggleMarkdownWrapResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function expandToWord(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { start: number; end: number } {
  let start = selectionStart;
  let end = selectionEnd;
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  if (start !== end) return { start, end };

  while (start > 0 && WORD_CHAR.test(value[start - 1] ?? '')) start -= 1;
  while (end < value.length && WORD_CHAR.test(value[end] ?? '')) end += 1;
  return { start, end };
}

function selectionIncludesMarkers(
  selected: string,
  marker: string,
): boolean {
  const m = marker.length;
  if (selected.length < m * 2) return false;
  if (!selected.startsWith(marker) || !selected.endsWith(marker)) return false;
  if (marker === '*') {
    // Avoid treating **bold** as italic wrap
    if (selected.startsWith('**') && selected.endsWith('**')) return false;
  }
  return true;
}

function markersOutsideSelection(
  value: string,
  start: number,
  end: number,
  marker: string,
): boolean {
  const m = marker.length;
  if (start < m) return false;
  if (value.slice(start - m, start) !== marker) return false;
  if (value.slice(end, end + m) !== marker) return false;
  if (marker === '*') {
    // Left edge must not be the second char of **
    if (start >= 2 && value[start - 2] === '*') return false;
    // Right edge must not continue as **
    if (value[end + m] === '*') return false;
  }
  return true;
}

/**
 * Toggle markdown wrap markers around the current selection (bold **, italic *).
 * Re-applying the same shortcut unwraps.
 */
export function toggleMarkdownWrap(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: string,
): ToggleMarkdownWrapResult {
  const m = marker.length;
  let { start, end } = expandToWord(value, selectionStart, selectionEnd);

  const selected = value.slice(start, end);

  if (selectionIncludesMarkers(selected, marker)) {
    const inner = selected.slice(m, selected.length - m);
    return {
      value: value.slice(0, start) + inner + value.slice(end),
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }

  if (markersOutsideSelection(value, start, end, marker)) {
    return {
      value: value.slice(0, start - m) + selected + value.slice(end + m),
      selectionStart: start - m,
      selectionEnd: end - m,
    };
  }

  const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
  if (selected.length === 0) {
    return {
      value: next,
      selectionStart: start + m,
      selectionEnd: start + m,
    };
  }
  return {
    value: next,
    selectionStart: start + m,
    selectionEnd: end + m,
  };
}
