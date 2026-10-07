import type { MediaActionResult, MediaUiActions } from '@lawless-intranet/media-ui';
import {
  completeMediaLibraryUpload,
  createMediaLibraryFolder,
  deleteMediaLibraryFile,
  deleteMediaLibraryFolder,
  getMediaContents,
  getMediaLibraryDownloadUrl,
  getMediaTree,
  requestMediaUpload,
  shareMediaLibraryFile,
  unshareMediaLibraryFile,
  updateMediaLibraryFile,
  updateMediaLibraryFolder,
} from '@/app/_actions/media';

type ActionResponse<T> =
  | { status: number; data: T }
  | { status: number; error?: string | { field: string | number; message: string }[] };

async function asMediaResult<T>(promise: Promise<ActionResponse<T>>): Promise<MediaActionResult<T>> {
  const result = await promise;
  if ('data' in result) {
    return { status: result.status, data: result.data };
  }
  return { status: result.status, error: result.error ?? 'Une erreur est survenue' };
}

/** Binds the shelter server actions to the media-ui action contract. */
export function createShelterMediaActions(shelterSlug: string): MediaUiActions {
  return {
    getFolderContents: (folderId) => asMediaResult(getMediaContents(shelterSlug, folderId)),
    getFolderTree: () => asMediaResult(getMediaTree(shelterSlug)),
    createFolder: (input) => asMediaResult(createMediaLibraryFolder(shelterSlug, input)),
    updateFolder: (input) => asMediaResult(updateMediaLibraryFolder(shelterSlug, input)),
    deleteFolder: (id) => asMediaResult(deleteMediaLibraryFolder(shelterSlug, id)),
    requestUpload: (input) => asMediaResult(requestMediaUpload(shelterSlug, input)),
    completeUpload: (fileId) => asMediaResult(completeMediaLibraryUpload(shelterSlug, fileId)),
    updateFile: (input) => asMediaResult(updateMediaLibraryFile(shelterSlug, input)),
    deleteFile: (id) => asMediaResult(deleteMediaLibraryFile(shelterSlug, id)),
    getDownloadUrl: (id) => asMediaResult(getMediaLibraryDownloadUrl(shelterSlug, id)),
    shareFile: (id) => asMediaResult(shareMediaLibraryFile(shelterSlug, id)),
    unshareFile: (id) => asMediaResult(unshareMediaLibraryFile(shelterSlug, id)),
  };
}
