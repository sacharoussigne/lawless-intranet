import type { MediaUiActions } from '@lawless-intranet/media-ui';
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

/** Binds the dispensary server actions to the media-ui action contract. */
export function createDispensaryMediaActions(dispensarySlug: string): MediaUiActions {
  return {
    getFolderContents: (folderId) => toUiResult(getMediaContents(dispensarySlug, folderId)),
    getFolderTree: () => toUiResult(getMediaTree(dispensarySlug)),
    createFolder: (input) => toUiResult(createMediaLibraryFolder(dispensarySlug, input)),
    updateFolder: (input) => toUiResult(updateMediaLibraryFolder(dispensarySlug, input)),
    deleteFolder: (id) => toUiResult(deleteMediaLibraryFolder(dispensarySlug, id)),
    requestUpload: (input) => toUiResult(requestMediaUpload(dispensarySlug, input)),
    completeUpload: (fileId) => toUiResult(completeMediaLibraryUpload(dispensarySlug, fileId)),
    updateFile: (input) => toUiResult(updateMediaLibraryFile(dispensarySlug, input)),
    deleteFile: (id) => toUiResult(deleteMediaLibraryFile(dispensarySlug, id)),
    getDownloadUrl: (id) => toUiResult(getMediaLibraryDownloadUrl(dispensarySlug, id)),
    moveItems: (input) => toUiResult(moveMediaLibraryItems(dispensarySlug, input)),
    deleteItems: (input) => toUiResult(deleteMediaLibraryItems(dispensarySlug, input)),
    shareFile: (id) => toUiResult(shareMediaLibraryFile(dispensarySlug, id)),
    unshareFile: (id) => toUiResult(unshareMediaLibraryFile(dispensarySlug, id)),
    getUserName: (userId) => toUiResult(getMediaUserName(dispensarySlug, userId)),
  };
}
