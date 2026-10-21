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
export function createBusinessMediaActions(businessSlug: string): MediaUiActions {
  return {
    getFolderContents: (folderId) =>
      toUiResult(fetchRead(businessSlug, 'mediaContents', { folderId })),
    getFolderTree: () => toUiResult(fetchRead(businessSlug, 'mediaTree')),
    createFolder: (input) => toUiResult(createMediaLibraryFolder(businessSlug, input)),
    updateFolder: (input) => toUiResult(updateMediaLibraryFolder(businessSlug, input)),
    deleteFolder: (id) => toUiResult(deleteMediaLibraryFolder(businessSlug, id)),
    requestUpload: (input) => toUiResult(requestMediaUpload(businessSlug, input)),
    completeUpload: (fileId) => toUiResult(completeMediaLibraryUpload(businessSlug, fileId)),
    updateFile: (input) => toUiResult(updateMediaLibraryFile(businessSlug, input)),
    deleteFile: (id) => toUiResult(deleteMediaLibraryFile(businessSlug, id)),
    getDownloadUrl: (id) => toUiResult(fetchRead(businessSlug, 'mediaDownloadUrl', { id })),
    createLink: (input) => toUiResult(createMediaLibraryLink(businessSlug, input)),
    updateLink: (input) => toUiResult(updateMediaLibraryLink(businessSlug, input)),
    moveItems: (input) => toUiResult(moveMediaLibraryItems(businessSlug, input)),
    deleteItems: (input) => toUiResult(deleteMediaLibraryItems(businessSlug, input)),
    shareFile: (id) => toUiResult(shareMediaLibraryFile(businessSlug, id)),
    unshareFile: (id) => toUiResult(unshareMediaLibraryFile(businessSlug, id)),
    getUserName: (userId) => toUiResult(fetchRead(businessSlug, 'mediaUserName', { userId })),
  };
}
