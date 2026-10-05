import type { MediaUploadTicketRecord } from '@lawless-intranet/types';

/**
 * Uploads a file straight to S3 with the presigned POST (XHR for progress).
 * S3 rejects the request itself if size/type/key do not match the ticket.
 */
export function uploadToPresignedPost(
  ticket: MediaUploadTicketRecord,
  file: File,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(ticket.fields)) {
      form.append(key, value);
    }
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', ticket.url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`Le stockage a refusé le fichier (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Envoi interrompu (réseau ou CORS du bucket)'));
    xhr.onabort = () => reject(new Error('Envoi annulé'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
