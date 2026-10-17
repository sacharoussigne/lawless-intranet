import type { MediaUiActions } from '@lawless-intranet/media-ui';
import { toUiResult } from '@lawless-intranet/host-kit/action';
import {
  completeMediaLibraryUpload,
  createMediaLibraryFolder,
  createMediaLibraryLink,
  deleteMediaLibraryFile,
  deleteMediaLibraryFolder,
  deleteMediaLibraryItems,
  moveMediaLibraryItems,
  requestMediaUpload,
  shareMediaLibraryFile,
  unshareMediaLibraryFile,
  updateMediaLibraryFile,
  updateMediaLibraryFolder,
  updateMediaLibraryLink,
} from '@/app/_actions/media';
import { fetchRead } from '@/lib/read/fetchRead';

/** Binds the dispensary server actions to the media-ui action contract (reads over GET, see lib/read). */
export function createDispensaryMediaActions(dispensarySlug: string): MediaUiActions {
  return {
    getFolderContents: (folderId) =>
      toUiResult(fetchRead(dispensarySlug, 'mediaContents', { folderId })),
    getFolderTree: () => toUiResult(fetchRead(dispensarySlug, 'mediaTree')),
    createFolder: (input) => toUiResult(createMediaLibraryFolder(dispensarySlug, input)),
    updateFolder: (input) => toUiResult(updateMediaLibraryFolder(dispensarySlug, input)),
    deleteFolder: (id) => toUiResult(deleteMediaLibraryFolder(dispensarySlug, id)),
    requestUpload: (input) => toUiResult(requestMediaUpload(dispensarySlug, input)),
    completeUpload: (fileId) => toUiResult(completeMediaLibraryUpload(dispensarySlug, fileId)),
    updateFile: (input) => toUiResult(updateMediaLibraryFile(dispensarySlug, input)),
    deleteFile: (id) => toUiResult(deleteMediaLibraryFile(dispensarySlug, id)),
    getDownloadUrl: (id) => toUiResult(fetchRead(dispensarySlug, 'mediaDownloadUrl', { id })),
    createLink: (input) => toUiResult(createMediaLibraryLink(dispensarySlug, input)),
    updateLink: (input) => toUiResult(updateMediaLibraryLink(dispensarySlug, input)),
    moveItems: (input) => toUiResult(moveMediaLibraryItems(dispensarySlug, input)),
    deleteItems: (input) => toUiResult(deleteMediaLibraryItems(dispensarySlug, input)),
    shareFile: (id) => toUiResult(shareMediaLibraryFile(dispensarySlug, id)),
    unshareFile: (id) => toUiResult(unshareMediaLibraryFile(dispensarySlug, id)),
    getUserName: (userId) => toUiResult(fetchRead(dispensarySlug, 'mediaUserName', { userId })),
  };
}
