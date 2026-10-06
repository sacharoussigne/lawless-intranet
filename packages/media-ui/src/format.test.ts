import { describe, expect, it } from 'vitest';
import { flattenFolderTree, formatBytes, getFileKind, splitExtension, stepIndex } from './format';

describe('formatBytes', () => {
  it('formats sizes in French units', () => {
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(1536)).toBe('1,5 Ko');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 Mo');
  });
});

describe('getFileKind', () => {
  it('classifies previewable files', () => {
    expect(getFileKind('image/webp')).toBe('image');
    expect(getFileKind('application/pdf')).toBe('pdf');
    expect(getFileKind('text/plain')).toBe('other');
  });
});

describe('flattenFolderTree', () => {
  const folders = [
    { id: 'b', parentId: null, name: 'Bêtes' },
    { id: 'a', parentId: null, name: 'Affiches' },
    { id: 'a2', parentId: 'a', name: 'Été' },
    { id: 'a1', parentId: 'a', name: 'Automne' },
    { id: 'a1x', parentId: 'a1', name: 'Vieilles' },
  ];

  it('lists folders depth-first, sorted by name', () => {
    expect(flattenFolderTree(folders).map((f) => `${f.depth}:${f.name}`)).toEqual([
      '0:Affiches',
      '1:Automne',
      '2:Vieilles',
      '1:Été',
      '0:Bêtes',
    ]);
  });

  it('excludes the moved folder and its subtree', () => {
    expect(flattenFolderTree(folders, 'a1').map((f) => f.id)).toEqual(['a', 'a2', 'b']);
  });
});

describe('splitExtension', () => {
  it('splits the last extension', () => {
    expect(splitExtension('affiche.finale.png')).toEqual({ base: 'affiche.finale', extension: '.png' });
    expect(splitExtension('.env')).toEqual({ base: '.env', extension: '' });
    expect(splitExtension('sans')).toEqual({ base: 'sans', extension: '' });
  });
});

describe('stepIndex', () => {
  it('moves within bounds without wrapping', () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBeNull();
    expect(stepIndex(0, -1, 3)).toBeNull();
    expect(stepIndex(2, -1, 3)).toBe(1);
  });
});
