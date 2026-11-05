'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadToPresignedPost, formatBytes } from '@lawless-intranet/media-ui';
import type { MediaLimitsRecord, MediaUploadTicketRecord } from '@lawless-intranet/types';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  completeLetterImageUpload,
  discardLetterImageUpload,
  requestLetterImageUpload,
} from '@/app/_actions/letters/images';
import { handleAction } from '@/lib/action';
import type { LetterImageDTO } from '@/types/letters';

export type LetterFormImage = {
  /** Stable key for the list (and the drag & drop). */
  key: string;
  /** Set once the storage has the file. */
  mediaFileId: string | null;
  name: string;
  /** Local preview while uploading, signed URL for saved images. */
  previewUrl: string | null;
  progress: number;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
  /** Uploaded in this form (deleted from the storage when the form is cancelled). */
  fresh: boolean;
};

const MAX_PARALLEL = 3;

export function toFormImages(images: LetterImageDTO[]): LetterFormImage[] {
  return images.map((image) => ({
    key: image.mediaFileId,
    mediaFileId: image.mediaFileId,
    name: image.name,
    previewUrl: image.previewUrl,
    progress: 1,
    status: 'ready',
    fresh: false,
  }));
}

/**
 * Images of the letter form: each file goes straight to the storage (presigned POST,
 * letters scope) as soon as it is added, so saving the letter only sends ids.
 */
export function useLetterImageUploads(boxId: string, limits: MediaLimitsRecord, initial: LetterFormImage[]) {
  const slug = useRequiredBusinessSlug();
  const [images, setImages] = useState<LetterFormImage[]>(initial);
  const sequence = useRef(0);
  const queue = useRef<{ key: string; file: File }[]>([]);
  const running = useRef(0);
  const objectUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const patch = useCallback((key: string, changes: Partial<LetterFormImage>) => {
    setImages((current) => current.map((image) => (image.key === key ? { ...image, ...changes } : image)));
  }, []);

  const uploadOne = useCallback(
    async (key: string, file: File) => {
      try {
        const ticket = handleAction(
          await requestLetterImageUpload(slug, { boxId, name: file.name, mimeType: file.type, size: file.size }),
        ) as MediaUploadTicketRecord;
        await uploadToPresignedPost(ticket, file, (ratio) => patch(key, { progress: ratio }));
        handleAction(await completeLetterImageUpload(slug, { boxId, fileId: ticket.fileId }));
        patch(key, { mediaFileId: ticket.fileId, status: 'ready', progress: 1 });
      } catch (error) {
        patch(key, { status: 'error', error: error instanceof Error ? error.message : 'Envoi impossible' });
      }
    },
    [boxId, patch, slug],
  );

  /** Starts queued uploads, MAX_PARALLEL at a time; each one that ends starts the next. */
  const pump = useCallback(() => {
    const run = () => {
      while (running.current < MAX_PARALLEL) {
        const next = queue.current.shift();
        if (!next) return;
        running.current += 1;
        void uploadOne(next.key, next.file).finally(() => {
          running.current -= 1;
          run();
        });
      }
    };
    run();
  }, [uploadOne]);

  const validate = useCallback(
    (file: File): string | null => {
      if (!limits.storageConfigured) return 'Stockage des images non configuré';
      if (!limits.allowedMimeTypes.includes(file.type) || !file.type.startsWith('image/')) {
        return 'Seules les images sont acceptées (PNG, JPEG, WebP, GIF)';
      }
      if (file.size > limits.maxFileSizeBytes) return `Trop volumineuse (maximum ${formatBytes(limits.maxFileSizeBytes)})`;
      return null;
    },
    [limits],
  );

  const add = useCallback(
    (files: File[]) => {
      const added = files.map((file): LetterFormImage => {
        sequence.current += 1;
        const error = validate(file);
        const previewUrl = error ? null : URL.createObjectURL(file);
        if (previewUrl) objectUrls.current.push(previewUrl);
        const key = `new-${sequence.current}`;
        if (!error) queue.current.push({ key, file });
        return {
          key,
          mediaFileId: null,
          name: file.name,
          previewUrl,
          progress: 0,
          status: error ? 'error' : 'uploading',
          error: error ?? undefined,
          fresh: true,
        };
      });
      setImages((current) => [...current, ...added]);
      pump();
    },
    [pump, validate],
  );

  const remove = useCallback(
    (key: string) => {
      const image = images.find((entry) => entry.key === key);
      // A file uploaded here and not saved yet would stay in the storage for nothing.
      if (image?.fresh && image.mediaFileId) {
        void discardLetterImageUpload(slug, { boxId, fileId: image.mediaFileId });
      }
      setImages((current) => current.filter((entry) => entry.key !== key));
    },
    [boxId, images, slug],
  );

  /** Form closed without saving: removes what was uploaded for it. */
  const discardFresh = useCallback(() => {
    for (const image of images) {
      if (image.fresh && image.mediaFileId) void discardLetterImageUpload(slug, { boxId, fileId: image.mediaFileId });
    }
  }, [boxId, images, slug]);

  return {
    images,
    setImages,
    add,
    remove,
    discardFresh,
    uploading: images.some((image) => image.status === 'uploading'),
    failed: images.some((image) => image.status === 'error'),
  };
}
