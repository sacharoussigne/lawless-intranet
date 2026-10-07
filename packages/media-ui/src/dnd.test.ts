import { describe, expect, it } from 'vitest';
import { canDrop, dragId, dropId, parseDropId } from './dnd';

describe('drop ids', () => {
  it('round-trips folders and the root', () => {
    expect(parseDropId(dropId('abc'))).toBe('abc');
    expect(parseDropId(dropId(null))).toBeNull();
    expect(parseDropId(dragId({ kind: 'file', id: 'abc' }))).toBeUndefined();
  });
});

describe('canDrop', () => {
  const file = { kind: 'file' as const, id: 'f1', parentId: 'a' };
  const folder = { kind: 'folder' as const, id: 'b', parentId: 'a' };

  it('refuses dropping into the current folder', () => {
    expect(canDrop(file, 'a')).toBe(false);
    expect(canDrop(folder, 'a')).toBe(false);
  });

  it('refuses dropping a folder into itself', () => {
    expect(canDrop(folder, 'b')).toBe(false);
  });

  it('accepts other folders and the root', () => {
    expect(canDrop(file, 'b')).toBe(true);
    expect(canDrop(file, null)).toBe(true);
    expect(canDrop(folder, 'c')).toBe(true);
  });
});
