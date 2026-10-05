export type MediaScopeParams = {
  scopeType: string;
  scopeId: string;
};

export type MediaFolderRecord = {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type MediaFileRecord = {
  id: string;
  folderId: string | null;
  /** Display name (original file name, or the name given in the library). */
  name: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  /** Short-lived signed URL to display the file inline (images, PDF). */
  previewUrl: string | null;
};

export type MediaBreadcrumbItem = {
  id: string;
  name: string;
};

export type MediaFolderContentsRecord = {
  /** Null for the library root. */
  folder: MediaFolderRecord | null;
  /** From the root (excluded) to the current folder (included). */
  breadcrumb: MediaBreadcrumbItem[];
  folders: MediaFolderRecord[];
  files: MediaFileRecord[];
};

export type MediaTreeFolderRecord = {
  id: string;
  parentId: string | null;
  name: string;
};

export type MediaUploadTicketRecord = {
  fileId: string;
  /** Multipart POST target (S3 presigned post). */
  url: string;
  /** Form fields to send before the `file` field. */
  fields: Record<string, string>;
  expiresAt: string;
};

export type MediaLimitsRecord = {
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
  storageConfigured: boolean;
};

export type MediaDownloadUrlRecord = {
  url: string;
  expiresAt: string;
};
