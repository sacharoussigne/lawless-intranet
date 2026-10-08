import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEDIA_SORT,
  describeDeletion,
  flattenFolderTree,
  nextSort,
  parseMediaSort,
  describeFileType,
  sortItems, formatBytes, getFileKind, splitExtension, stepIndex, wasModified } from './format';

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

  it('excludes the moved folders and their subtrees', () => {
    expect(flattenFolderTree(folders, ['a1']).map((f) => f.id)).toEqual(['a', 'a2', 'b']);
    expect(flattenFolderTree(folders, ['a1', 'b']).map((f) => f.id)).toEqual(['a', 'a2']);
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

describe('describeDeletion', () => {
  it('names a single item', () => {
    expect(describeDeletion([{ name: 'a.png', isFolder: false }])).toBe('Supprimer le fichier « a.png » ?');
  });

  it('counts folders and files', () => {
    expect(
      describeDeletion([
        { name: 'A', isFolder: true },
        { name: 'b.png', isFolder: false },
        { name: 'c.png', isFolder: false },
      ]),
    ).toBe('Supprimer 1 dossier (avec tout son contenu) et 2 fichiers ?');
  });
});

describe('sortItems', () => {
  const items = [
    { name: 'Photo 10', createdAt: '2026-01-03T00:00:00Z' },
    { name: 'photo 2', createdAt: '2026-01-01T00:00:00Z' },
    { name: 'Écurie', createdAt: '2026-01-02T00:00:00Z' },
  ];

  it('sorts names naturally, ignoring case and accents', () => {
    expect(sortItems(items, { key: 'name', direction: 'asc' }).map((i) => i.name)).toEqual([
      'Écurie',
      'photo 2',
      'Photo 10',
    ]);
  });

  it('sorts by upload date in both directions', () => {
    expect(sortItems(items, { key: 'date', direction: 'desc' }).map((i) => i.name)).toEqual([
      'Photo 10',
      'Écurie',
      'photo 2',
    ]);
    expect(sortItems(items, { key: 'date', direction: 'asc' })[0]?.name).toBe('photo 2');
  });
});

describe('nextSort', () => {
  it('flips the direction on the same key, starts dates with the newest', () => {
    expect(nextSort(DEFAULT_MEDIA_SORT, 'name')).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort(DEFAULT_MEDIA_SORT, 'date')).toEqual({ key: 'date', direction: 'desc' });
  });
});

describe('parseMediaSort', () => {
  it('falls back to the default on invalid values', () => {
    expect(parseMediaSort({ key: 'date', direction: 'asc' })).toEqual({ key: 'date', direction: 'asc' });
    expect(parseMediaSort({ key: 'size', direction: 'asc' })).toEqual(DEFAULT_MEDIA_SORT);
    expect(parseMediaSort(null)).toEqual(DEFAULT_MEDIA_SORT);
  });
});

describe('describeFileType', () => {
  it('labels known types and falls back to the MIME type', () => {
    expect(describeFileType('image/png')).toBe('Image PNG');
    expect(describeFileType('application/pdf')).toBe('Document PDF');
    expect(describeFileType('text/plain')).toBe('text/plain');
  });
});

describe('wasModified', () => {
  it('ignores the upload completion right after creation', () => {
    expect(wasModified('2026-10-07T10:00:00.000Z', '2026-10-07T10:00:05.000Z')).toBe(false);
  });

  it('detects a later change', () => {
    expect(wasModified('2026-10-07T10:00:00.000Z', '2026-10-08T09:00:00.000Z')).toBe(true);
  });
});
