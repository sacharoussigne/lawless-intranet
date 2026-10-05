import type {
  MediaDownloadUrlRecord,
  MediaFileRecord,
  MediaFolderContentsRecord,
  MediaFolderRecord,
  MediaLimitsRecord,
  MediaScopeParams,
  MediaTreeFolderRecord,
  MediaUploadTicketRecord,
} from '@lawless-intranet/types';
import { mediaFetch, parseJsonResponse, toQuery, type MediaFetchOptions } from './config';

type ClientOptions = Pick<MediaFetchOptions, 'cookieHeader'>;

export async function getMediaLimits(options: ClientOptions = {}): Promise<MediaLimitsRecord> {
  return parseJsonResponse(await mediaFetch('/api/limits', options));
}

export async function getMediaFolderContents(
  scope: MediaScopeParams,
  folderId: string | null,
  options: ClientOptions = {},
): Promise<MediaFolderContentsRecord> {
  return parseJsonResponse(
    await mediaFetch(`/api/folders/contents${toQuery({ ...scope, folderId })}`, options),
  );
}

export async function getMediaFolderTree(
  scope: MediaScopeParams,
  options: ClientOptions = {},
): Promise<MediaTreeFolderRecord[]> {
  return parseJsonResponse(await mediaFetch(`/api/folders/tree${toQuery({ ...scope })}`, options));
}

export async function createMediaFolder(
  scope: MediaScopeParams,
  input: { parentId: string | null; name: string },
  options: ClientOptions = {},
): Promise<MediaFolderRecord> {
  return parseJsonResponse(
    await mediaFetch('/api/folders', {
      method: 'POST',
      cookieHeader: options.cookieHeader,
      body: JSON.stringify({ ...scope, ...input }),
    }),
  );
}

export async function updateMediaFolder(
  scope: MediaScopeParams,
  folderId: string,
  input: { name?: string; parentId?: string | null },
  options: ClientOptions = {},
): Promise<MediaFolderRecord> {
  return parseJsonResponse(
    await mediaFetch(`/api/folders/${encodeURIComponent(folderId)}`, {
      method: 'PATCH',
      cookieHeader: options.cookieHeader,
      body: JSON.stringify({ ...scope, ...input }),
    }),
  );
}

export async function deleteMediaFolder(
  scope: MediaScopeParams,
  folderId: string,
  options: ClientOptions = {},
): Promise<{ deletedFiles: number }> {
  return parseJsonResponse(
    await mediaFetch(`/api/folders/${encodeURIComponent(folderId)}${toQuery({ ...scope })}`, {
      method: 'DELETE',
      cookieHeader: options.cookieHeader,
    }),
  );
}

export async function createMediaUpload(
  scope: MediaScopeParams,
  input: { folderId: string | null; name: string; mimeType: string; size: number },
  options: ClientOptions = {},
): Promise<MediaUploadTicketRecord> {
  return parseJsonResponse(
    await mediaFetch('/api/files/uploads', {
      method: 'POST',
      cookieHeader: options.cookieHeader,
      body: JSON.stringify({ ...scope, ...input }),
    }),
  );
}

export async function completeMediaUpload(
  scope: MediaScopeParams,
  fileId: string,
  options: ClientOptions = {},
): Promise<MediaFileRecord> {
  return parseJsonResponse(
    await mediaFetch(`/api/files/${encodeURIComponent(fileId)}/complete`, {
      method: 'POST',
      cookieHeader: options.cookieHeader,
      body: JSON.stringify(scope),
    }),
  );
}

export async function updateMediaFile(
  scope: MediaScopeParams,
  fileId: string,
  input: { name?: string; folderId?: string | null },
  options: ClientOptions = {},
): Promise<MediaFileRecord> {
  return parseJsonResponse(
    await mediaFetch(`/api/files/${encodeURIComponent(fileId)}`, {
      method: 'PATCH',
      cookieHeader: options.cookieHeader,
      body: JSON.stringify({ ...scope, ...input }),
    }),
  );
}

export async function deleteMediaFile(
  scope: MediaScopeParams,
  fileId: string,
  options: ClientOptions = {},
): Promise<{ success: true }> {
  return parseJsonResponse(
    await mediaFetch(`/api/files/${encodeURIComponent(fileId)}${toQuery({ ...scope })}`, {
      method: 'DELETE',
      cookieHeader: options.cookieHeader,
    }),
  );
}

export async function getMediaDownloadUrl(
  scope: MediaScopeParams,
  fileId: string,
  options: ClientOptions = {},
): Promise<MediaDownloadUrlRecord> {
  return parseJsonResponse(
    await mediaFetch(
      `/api/files/${encodeURIComponent(fileId)}/download-url${toQuery({ ...scope })}`,
      options,
    ),
  );
}

/** Host-only (no user): deletes every folder, file and S3 object of a tenant. */
export async function purgeMediaScope(
  scope: MediaScopeParams,
): Promise<{ files: number; folders: number }> {
  return parseJsonResponse(
    await mediaFetch('/api/purge-scope', { method: 'POST', body: JSON.stringify(scope) }),
  );
}
