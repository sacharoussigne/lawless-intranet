import type { MediaActionResult, MediaUiActions } from '@lawless-intranet/media-ui';
import { toUiResult } from '@lawless-intranet/host-kit/action';
import {
  completeMediaLibraryUpload,
  createMediaLibraryFolder,
  deleteMediaLibraryFile,
  deleteMediaLibraryFolder,
  deleteMediaLibraryItems,
  getMediaContents,
  getMediaLibraryDownloadUrl,
  getMediaTree,
  getMediaUserName,
  moveMediaLibraryItems,
  requestMediaUpload,
  shareMediaLibraryFile,
  unshareMediaLibraryFile,
  updateMediaLibraryFile,
  updateMediaLibraryFolder,
} from '@/app/_actions/media';

/** Binds the shelter server actions to the media-ui action contract. */
export function createShelterMediaActions(shelterSlug: string): MediaUiActions {
  return {
    getFolderContents: (folderId) => toUiResult(getMediaContents(shelterSlug, folderId)),
    getFolderTree: () => toUiResult(getMediaTree(shelterSlug)),
    createFolder: (input) => toUiResult(createMediaLibraryFolder(shelterSlug, input)),
    updateFolder: (input) => toUiResult(updateMediaLibraryFolder(shelterSlug, input)),
    deleteFolder: (id) => toUiResult(deleteMediaLibraryFolder(shelterSlug, id)),
    requestUpload: (input) => toUiResult(requestMediaUpload(shelterSlug, input)),
    completeUpload: (fileId) => toUiResult(completeMediaLibraryUpload(shelterSlug, fileId)),
    updateFile: (input) => toUiResult(updateMediaLibraryFile(shelterSlug, input)),
    deleteFile: (id) => toUiResult(deleteMediaLibraryFile(shelterSlug, id)),
    getDownloadUrl: (id) => toUiResult(getMediaLibraryDownloadUrl(shelterSlug, id)),
    moveItems: (input) => toUiResult(moveMediaLibraryItems(shelterSlug, input)),
    deleteItems: (input) => toUiResult(deleteMediaLibraryItems(shelterSlug, input)),
    shareFile: (id) => toUiResult(shareMediaLibraryFile(shelterSlug, id)),
    unshareFile: (id) => toUiResult(unshareMediaLibraryFile(shelterSlug, id)),
    getUserName: (userId) => toUiResult(getMediaUserName(shelterSlug, userId)),
  };
}
