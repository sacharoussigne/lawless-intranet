'use client';

import { useCallback, useRef, useState } from 'react';
import { useMediaUi } from '../MediaUiProvider';
import { formatBytes } from '../format';
import { runMediaAction } from '../runMediaAction';
import { uploadToPresignedPost } from '../upload';
import { useInvalidateMedia } from './useMediaQueries';

export type MediaUploadItem = {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
};

const MAX_PARALLEL_UPLOADS = 3;

/**
 * Upload queue: ticket (host action) → direct POST to S3 → completion check.
 * Files are validated client-side first for a fast, clear error.
 */
export function useMediaUploads() {
  const { actions, limits } = useMediaUi();
  const invalidate = useInvalidateMedia();
  const [items, setItems] = useState<MediaUploadItem[]>([]);
  const sequenceRef = useRef(0);

  const patch = useCallback((id: string, changes: Partial<MediaUploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const validate = useCallback(
    (file: File): string | null => {
      if (!limits.storageConfigured) return 'Stockage non configuré';
      if (!limits.allowedMimeTypes.includes(file.type)) {
        return 'Type non autorisé (images PNG, JPEG, WebP, GIF ou PDF)';
      }
      if (file.size <= 0) return 'Fichier vide';
      if (file.size > limits.maxFileSizeBytes) {
        return `Trop volumineux (maximum ${formatBytes(limits.maxFileSizeBytes)})`;
      }
      return null;
    },
    [limits],
  );

  const uploadOne = useCallback(
    async (id: string, file: File, folderId: string | null) => {
      try {
        patch(id, { status: 'uploading' });
        const ticket = runMediaAction(
          await actions.requestUpload({ folderId, name: file.name, mimeType: file.type, size: file.size }),
        );
        await uploadToPresignedPost(ticket, file, (ratio) => patch(id, { progress: ratio }));
        runMediaAction(await actions.completeUpload(ticket.fileId));
        patch(id, { status: 'done', progress: 1 });
      } catch (error) {
        patch(id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Import impossible',
        });
      }
    },
    [actions, patch],
  );

  const upload = useCallback(
    async (files: File[], folderId: string | null) => {
      const queued = files.map((file) => {
        sequenceRef.current += 1;
        const error = validate(file);
        const item: MediaUploadItem = {
          id: `upload-${sequenceRef.current}`,
          name: file.name,
          progress: 0,
          status: error ? 'error' : 'pending',
          error: error ?? undefined,
        };
        return { item, file, valid: !error };
      });
      setItems((current) => [...current, ...queued.map((entry) => entry.item)]);

      const pending = queued.filter((entry) => entry.valid);
      for (let index = 0; index < pending.length; index += MAX_PARALLEL_UPLOADS) {
        const batch = pending.slice(index, index + MAX_PARALLEL_UPLOADS);
        await Promise.all(batch.map((entry) => uploadOne(entry.item.id, entry.file, folderId)));
        // Show finished files as soon as each batch completes.
        await invalidate();
      }
    },
    [invalidate, uploadOne, validate],
  );

  const clearFinished = useCallback(() => {
    setItems((current) => current.filter((item) => item.status === 'pending' || item.status === 'uploading'));
  }, []);

  return { items, upload, clearFinished };
}
