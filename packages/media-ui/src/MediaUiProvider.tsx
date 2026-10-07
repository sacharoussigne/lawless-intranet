'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  MediaDownloadUrlRecord,
  MediaFileRecord,
  MediaFolderContentsRecord,
  MediaFolderRecord,
  MediaLimitsRecord,
  MediaTreeFolderRecord,
  MediaUploadTicketRecord,
} from '@lawless-intranet/types';
import type { MediaActionResult } from './runMediaAction';

/** Server actions injected by the host app (scope and permissions are resolved there). */
export type MediaUiActions = {
  getFolderContents: (folderId: string | null) => Promise<MediaActionResult<MediaFolderContentsRecord>>;
  getFolderTree: () => Promise<MediaActionResult<MediaTreeFolderRecord[]>>;
  createFolder: (input: {
    parentId: string | null;
    name: string;
  }) => Promise<MediaActionResult<MediaFolderRecord>>;
  updateFolder: (input: {
    id: string;
    name?: string;
    parentId?: string | null;
  }) => Promise<MediaActionResult<MediaFolderRecord>>;
  deleteFolder: (id: string) => Promise<MediaActionResult<{ deletedFiles: number }>>;
  requestUpload: (input: {
    folderId: string | null;
    name: string;
    mimeType: string;
    size: number;
  }) => Promise<MediaActionResult<MediaUploadTicketRecord>>;
  completeUpload: (fileId: string) => Promise<MediaActionResult<MediaFileRecord>>;
  updateFile: (input: {
    id: string;
    name?: string;
    folderId?: string | null;
  }) => Promise<MediaActionResult<MediaFileRecord>>;
  deleteFile: (id: string) => Promise<MediaActionResult<{ success: true }>>;
  getDownloadUrl: (id: string) => Promise<MediaActionResult<MediaDownloadUrlRecord>>;
  /** Batch operations of the multiple selection. */
  moveItems: (input: {
    folderIds: string[];
    fileIds: string[];
    destinationId: string | null;
  }) => Promise<MediaActionResult<{ moved: number }>>;
  deleteItems: (input: {
    folderIds: string[];
    fileIds: string[];
  }) => Promise<MediaActionResult<{ deletedFiles: number }>>;
  shareFile: (id: string) => Promise<MediaActionResult<MediaFileRecord>>;
  unshareFile: (id: string) => Promise<MediaActionResult<MediaFileRecord>>;
};

export type MediaUiContextValue = {
  /** Tenant key (e.g. shelterSlug): part of every query key. */
  scopeKey: string;
  actions: MediaUiActions;
  limits: MediaLimitsRecord;
  /** Date display (hosts may use the RP calendar). */
  formatDate: (iso: string) => string;
  /** Absolute public URL of a share token; sharing is hidden when the host gives none. */
  buildShareUrl?: (token: string, fileName: string) => string;
};

const MediaUiContext = createContext<MediaUiContextValue | null>(null);

const defaultFormatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export type MediaUiProviderProps = {
  scopeKey: string;
  actions: MediaUiActions;
  limits: MediaLimitsRecord;
  formatDate?: (iso: string) => string;
  buildShareUrl?: (token: string, fileName: string) => string;
  children: ReactNode;
};

export function MediaUiProvider({
  scopeKey,
  actions,
  limits,
  formatDate = defaultFormatDate,
  buildShareUrl,
  children,
}: MediaUiProviderProps) {
  const value = useMemo<MediaUiContextValue>(
    () => ({ scopeKey, actions, limits, formatDate, buildShareUrl }),
    [scopeKey, actions, limits, formatDate, buildShareUrl],
  );
  return <MediaUiContext.Provider value={value}>{children}</MediaUiContext.Provider>;
}

export function useMediaUi(): MediaUiContextValue {
  const context = useContext(MediaUiContext);
  if (!context) {
    throw new Error('useMediaUi must be used within MediaUiProvider');
  }
  return context;
}
