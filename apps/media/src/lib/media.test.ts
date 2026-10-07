import { describe, expect, it } from 'vitest';
import { getMaxFileSizeBytes, validateUpload } from './limits';
import {
  buildContentDisposition,
  buildStorageKey,
  generateShareToken,
  isShareToken,
  normalizeMediaName,
} from './names';
import { buildBreadcrumb, collectSubtreeIds, isSameOrDescendant } from './tree';

const MB = 1024 * 1024;

describe('upload limits', () => {
  it('defaults to 20 MB and reads MEDIA_MAX_FILE_SIZE_MB', () => {
    expect(getMaxFileSizeBytes({})).toBe(20 * MB);
    expect(getMaxFileSizeBytes({ MEDIA_MAX_FILE_SIZE_MB: '5' })).toBe(5 * MB);
    expect(getMaxFileSizeBytes({ MEDIA_MAX_FILE_SIZE_MB: 'nope' })).toBe(20 * MB);
  });

  it('accepts images and PDF within the limit', () => {
    expect(validateUpload({ mimeType: 'image/png', size: 1024 }, 20 * MB)).toEqual({ ok: true });
    expect(validateUpload({ mimeType: 'application/pdf', size: 20 * MB }, 20 * MB)).toEqual({ ok: true });
  });

  it('rejects other types, empty and oversized files', () => {
    expect(validateUpload({ mimeType: 'application/x-msdownload', size: 10 }, 20 * MB).ok).toBe(false);
    expect(validateUpload({ mimeType: 'image/svg+xml', size: 10 }, 20 * MB).ok).toBe(false);
    expect(validateUpload({ mimeType: 'image/png', size: 0 }, 20 * MB).ok).toBe(false);
    expect(validateUpload({ mimeType: 'image/png', size: 20 * MB + 1 }, 20 * MB)).toEqual({
      ok: false,
      error: 'Fichier trop volumineux (maximum 20 Mo)',
    });
  });
});

describe('names', () => {
  it('normalizes display names', () => {
    expect(normalizeMediaName('  Photo   chien.png ')).toBe('Photo chien.png');
    expect(normalizeMediaName('a/b\\c\u0000.pdf')).toBe('abc.pdf');
    expect(normalizeMediaName(' \t ')).toBe('');
  });

  it('builds tenant-prefixed storage keys without user input', () => {
    expect(buildStorageKey('shelter', 's1', 'uuid-1')).toBe('shelter/s1/uuid-1');
    expect(buildStorageKey('shelter', 's1')).toMatch(/^shelter\/s1\/[0-9a-f-]{36}$/);
  });

  it('encodes the download name for Content-Disposition', () => {
    expect(buildContentDisposition('Fiche été (1).pdf')).toBe(
      `attachment; filename="Fiche _t_ (1).pdf"; filename*=UTF-8''Fiche%20%C3%A9t%C3%A9%20%281%29.pdf`,
    );
    expect(buildContentDisposition('a"b.png', 'inline')).toBe(
      `inline; filename="a_b.png"; filename*=UTF-8''a%22b.png`,
    );
  });
});

describe('folder tree', () => {
  const folders = [
    { id: 'a', parentId: null, name: 'A' },
    { id: 'b', parentId: 'a', name: 'B' },
    { id: 'c', parentId: 'b', name: 'C' },
    { id: 'd', parentId: null, name: 'D' },
  ];

  it('detects moves into the own subtree', () => {
    expect(isSameOrDescendant(folders, 'a', 'a')).toBe(true);
    expect(isSameOrDescendant(folders, 'a', 'c')).toBe(true);
    expect(isSameOrDescendant(folders, 'b', 'd')).toBe(false);
    expect(isSameOrDescendant(folders, 'c', 'a')).toBe(false);
  });

  it('collects a subtree', () => {
    expect(collectSubtreeIds(folders, 'a').sort()).toEqual(['a', 'b', 'c']);
    expect(collectSubtreeIds(folders, 'd')).toEqual(['d']);
  });

  it('builds the breadcrumb from the root', () => {
    expect(buildBreadcrumb(folders, 'c').map((f) => f.name)).toEqual(['A', 'B', 'C']);
  });

  it('survives corrupted cycles', () => {
    const cyclic = [
      { id: 'x', parentId: 'y' },
      { id: 'y', parentId: 'x' },
    ];
    expect(isSameOrDescendant(cyclic, 'z', 'x')).toBe(false);
    expect(buildBreadcrumb(cyclic, 'x')).toHaveLength(2);
  });
});

describe('share tokens', () => {
  it('generates unique URL-safe tokens that pass validation', () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
    expect(isShareToken(a)).toBe(true);
    expect(encodeURIComponent(a)).toBe(a);
  });

  it('rejects malformed tokens', () => {
    expect(isShareToken('')).toBe(false);
    expect(isShareToken('short')).toBe(false);
    expect(isShareToken('a'.repeat(31) + '/')).toBe(false);
  });
});
