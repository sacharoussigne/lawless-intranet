import { describe, expect, it } from 'vitest';
import { abandonedUploadsCutoff, getMaxFileSizeBytes, validateUpload } from './limits';
import { UPLOAD_TICKET_TTL_SECONDS } from './s3';
import {
  buildContentDisposition,
  buildStorageKey,
  defaultLinkName,
  generateShareToken,
  isShareToken,
  MEDIA_LINK_URL_MAX_LENGTH,
  normalizeLinkUrl,
  normalizeMediaName,
} from './names';
import { createLinkSchema, deleteItemsSchema } from './validation';
import {
  buildBreadcrumb,
  collectSubtreeIds,
  collectSubtreesIds,
  isSameOrDescendant,
  wouldCreateCycle,
} from './tree';

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

  it('detects cycles when moving several folders', () => {
    expect(wouldCreateCycle(folders, ['d', 'a'], 'c')).toBe(true);
    expect(wouldCreateCycle(folders, ['b', 'd'], 'a')).toBe(false);
    expect(wouldCreateCycle(folders, ['a'], null)).toBe(false);
  });

  it('collects several subtrees without duplicates', () => {
    expect(collectSubtreesIds(folders, ['a', 'b', 'd']).sort()).toEqual(['a', 'b', 'c', 'd']);
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

describe('abandoned uploads', () => {
  it('only targets uploads older than a day', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    expect(abandonedUploadsCutoff(now).toISOString()).toBe('2026-10-07T12:00:00.000Z');
  });

  it('never reaches an upload whose ticket is still valid', () => {
    const now = new Date();
    const ticketStart = now.getTime() - UPLOAD_TICKET_TTL_SECONDS * 1000;
    expect(abandonedUploadsCutoff(now).getTime()).toBeLessThan(ticketStart);
  });
});

describe('links', () => {
  const scope = { scopeType: 'dispensary', scopeId: 'd1' };

  it('keeps http(s) URLs only', () => {
    expect(normalizeLinkUrl('  https://docs.google.com/spreadsheets/d/abc  ')).toBe(
      'https://docs.google.com/spreadsheets/d/abc',
    );
    expect(normalizeLinkUrl('http://exemple.fr')).toBe('http://exemple.fr/');
    for (const refused of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://exemple.fr',
      'mailto:a@b.fr',
      'docs.google.com',
      '',
      `https://exemple.fr/${'a'.repeat(MEDIA_LINK_URL_MAX_LENGTH)}`,
    ]) {
      expect(normalizeLinkUrl(refused)).toBeNull();
    }
  });

  it('names a link after its host when no name is given', () => {
    expect(defaultLinkName('https://www.docs.google.com/x')).toBe('docs.google.com');
    expect(defaultLinkName('http://exemple.fr:8080/a')).toBe('exemple.fr');
  });

  it('validates a new link and explains a refused URL', () => {
    const parsed = createLinkSchema.safeParse({ ...scope, url: 'https://exemple.fr', name: '  Tableau  ' });
    expect(parsed.success && parsed.data).toMatchObject({ url: 'https://exemple.fr/', name: 'Tableau' });

    const refused = createLinkSchema.safeParse({ ...scope, url: 'javascript:alert(1)' });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]?.message).toBe('Adresse invalide (http:// ou https:// uniquement)');
  });

  it('counts links as selected items', () => {
    const id = '0b9d6f6e-3f0b-4c1a-9f6f-3c2f4d1e2a10';
    expect(deleteItemsSchema.safeParse({ ...scope, linkIds: [id] }).success).toBe(true);
    expect(deleteItemsSchema.safeParse({ ...scope }).success).toBe(false);
  });
});
