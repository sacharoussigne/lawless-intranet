import { describe, expect, it } from 'vitest';
import {
  applyClick,
  EMPTY_SELECTION,
  itemKey,
  parseItemKey,
  pruneSelection,
  rectFromPoints,
  rectsIntersect,
  selectOnly,
  splitSelection,
} from './selection';

const order = ['folder:a', 'folder:b', 'file:c', 'file:d', 'file:e'];
const plain = { toggle: false, range: false };
const ctrl = { toggle: true, range: false };
const shift = { toggle: false, range: true };

describe('item keys', () => {
  it('round-trips kind and id', () => {
    expect(parseItemKey(itemKey('file', 'x:y'))).toEqual({ kind: 'file', id: 'x:y' });
  });
});

describe('applyClick', () => {
  it('selects only the clicked item on a plain click', () => {
    const result = applyClick({ keys: new Set(['folder:a', 'file:c']), anchor: 'folder:a' }, 'file:d', plain, order);
    expect([...result.keys]).toEqual(['file:d']);
    expect(result.anchor).toBe('file:d');
  });

  it('toggles with Ctrl', () => {
    const added = applyClick(selectOnly('folder:a'), 'file:c', ctrl, order);
    expect([...added.keys].sort()).toEqual(['file:c', 'folder:a']);
    const removed = applyClick(added, 'folder:a', ctrl, order);
    expect([...removed.keys]).toEqual(['file:c']);
  });

  it('selects a range with Shift, in both directions', () => {
    expect([...applyClick(selectOnly('folder:b'), 'file:d', shift, order).keys]).toEqual([
      'folder:b',
      'file:c',
      'file:d',
    ]);
    expect([...applyClick(selectOnly('file:d'), 'folder:b', shift, order).keys]).toEqual([
      'folder:b',
      'file:c',
      'file:d',
    ]);
  });

  it('adds the range to the selection with Ctrl+Shift', () => {
    const start = { keys: new Set(['file:e', 'folder:a']), anchor: 'folder:a' };
    const result = applyClick(start, 'folder:b', { toggle: true, range: true }, order);
    expect([...result.keys].sort()).toEqual(['file:e', 'folder:a', 'folder:b']);
  });

  it('falls back to a plain click without anchor', () => {
    expect([...applyClick(EMPTY_SELECTION, 'file:c', shift, order).keys]).toEqual(['file:c']);
  });
});

describe('pruneSelection', () => {
  it('drops items that are no longer displayed', () => {
    const result = pruneSelection({ keys: new Set(['file:c', 'file:z']), anchor: 'file:z' }, order);
    expect([...result.keys]).toEqual(['file:c']);
    expect(result.anchor).toBeNull();
  });

  it('keeps the same object when nothing changed', () => {
    const selection = selectOnly('file:c');
    expect(pruneSelection(selection, order)).toBe(selection);
  });
});

describe('splitSelection', () => {
  it('groups ids by kind', () => {
    expect(splitSelection(['folder:a', 'file:c', 'folder:b'])).toEqual({
      folderIds: ['a', 'b'],
      fileIds: ['c'],
    });
  });
});

describe('rectangles', () => {
  it('detects intersections', () => {
    const lasso = rectFromPoints({ x: 50, y: 50 }, { x: 0, y: 0 });
    expect(rectsIntersect(lasso, { left: 40, top: 40, right: 100, bottom: 100 })).toBe(true);
    expect(rectsIntersect(lasso, { left: 60, top: 0, right: 100, bottom: 40 })).toBe(false);
  });
});
