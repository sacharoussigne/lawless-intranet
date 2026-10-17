import { randomBytes, randomUUID } from 'node:crypto';

export const MEDIA_NAME_MAX_LENGTH = 255;

/** Control characters and path separators are not allowed in display names. */
const FORBIDDEN_NAME_CHARS = /[\u0000-\u001f\u007f/\\]/g;

/** Trims, strips forbidden characters and collapses whitespace. Returns '' when nothing is left. */
export function normalizeMediaName(raw: string): string {
  return raw.replace(FORBIDDEN_NAME_CHARS, '').replace(/\s+/g, ' ').trim();
}

/** S3 object key: tenant prefix (for purges) + random UUID (no user input). */
export function buildStorageKey(scopeType: string, scopeId: string, id: string = randomUUID()): string {
  return `${encodeURIComponent(scopeType)}/${encodeURIComponent(scopeId)}/${id}`;
}

export function buildScopePrefix(scopeType: string, scopeId: string): string {
  return `${encodeURIComponent(scopeType)}/${encodeURIComponent(scopeId)}/`;
}

/**
 * Content-Disposition header that keeps the display name on download
 * (RFC 6266: ASCII fallback + UTF-8 `filename*`).
 */
export function buildContentDisposition(
  fileName: string,
  disposition: 'attachment' | 'inline' = 'attachment',
): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'fichier';
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/** Share link token: 24 random bytes (192 bits), URL-safe. */
export function generateShareToken(): string {
  return randomBytes(24).toString('base64url');
}

const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function isShareToken(value: string): boolean {
  return SHARE_TOKEN_PATTERN.test(value);
}

export const MEDIA_LINK_URL_MAX_LENGTH = 2048;

/** Normalized http(s) URL of a saved link, or null (other protocols, such as `javascript:`, are refused). */
export function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MEDIA_LINK_URL_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;
  const normalized = url.toString();
  return normalized.length > MEDIA_LINK_URL_MAX_LENGTH ? null : normalized;
}

/** Display name of a link saved without one: its host, without `www.`. */
export function defaultLinkName(url: string): string {
  return normalizeMediaName(new URL(url).hostname.replace(/^www\./, '')).slice(0, MEDIA_NAME_MAX_LENGTH);
}
