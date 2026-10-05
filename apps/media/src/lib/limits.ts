/** Accepted uploads: images and PDF, all previewable in the browser. */
export const MEDIA_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

const DEFAULT_MAX_FILE_SIZE_MB = 20;

export function getMaxFileSizeBytes(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.MEDIA_MAX_FILE_SIZE_MB);
  const megabytes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_FILE_SIZE_MB;
  return Math.floor(megabytes * 1024 * 1024);
}

export function isAllowedMimeType(mimeType: string): boolean {
  return (MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export type UploadValidation = { ok: true } | { ok: false; error: string };

export function validateUpload(
  input: { mimeType: string; size: number },
  maxFileSizeBytes = getMaxFileSizeBytes(),
): UploadValidation {
  if (!isAllowedMimeType(input.mimeType)) {
    return { ok: false, error: 'Type de fichier non autorisé (images PNG, JPEG, WebP, GIF ou PDF)' };
  }
  if (!Number.isInteger(input.size) || input.size <= 0) {
    return { ok: false, error: 'Fichier vide' };
  }
  if (input.size > maxFileSizeBytes) {
    const maxMb = Math.round((maxFileSizeBytes / (1024 * 1024)) * 10) / 10;
    return { ok: false, error: `Fichier trop volumineux (maximum ${maxMb} Mo)` };
  }
  return { ok: true };
}
