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
import type { MediaFile, MediaFolder } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getMaxFileSizeBytes, MEDIA_ALLOWED_MIME_TYPES, validateUpload } from '@/lib/limits';
import { buildScopePrefix, buildStorageKey } from '@/lib/names';
import {
  createUploadTicket,
  deleteObjects,
  deletePrefix,
  headObject,
  isStorageConfigured,
  signReadUrl,
  StorageNotConfiguredError,
} from '@/lib/s3';
import { notifyMediaChange } from '@/lib/realtime';
import { buildBreadcrumb, collectSubtreeIds, isSameOrDescendant } from '@/lib/tree';

export type LibraryResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const notFound = (error: string): LibraryResult<never> => ({ ok: false, status: 404, error });
const badRequest = (error: string): LibraryResult<never> => ({ ok: false, status: 400, error });

function scopeWhere(scope: MediaScopeParams) {
  return { scopeType: scope.scopeType, scopeId: scope.scopeId };
}

function serializeFolder(folder: MediaFolder): MediaFolderRecord {
  return {
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

async function serializeFile(file: MediaFile): Promise<MediaFileRecord> {
  const previewUrl = isStorageConfigured()
    ? (await signReadUrl({ key: file.storageKey, fileName: file.name })).url
    : null;
  return {
    id: file.id,
    folderId: file.folderId,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    uploadedById: file.uploadedById,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    previewUrl,
  };
}

async function listScopeFolderNodes(scope: MediaScopeParams): Promise<MediaTreeFolderRecord[]> {
  return prisma.mediaFolder.findMany({
    where: scopeWhere(scope),
    select: { id: true, parentId: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function findFolder(scope: MediaScopeParams, id: string) {
  return prisma.mediaFolder.findFirst({ where: { id, ...scopeWhere(scope) } });
}

async function assertTargetFolder(
  scope: MediaScopeParams,
  folderId: string | null | undefined,
): Promise<LibraryResult<null>> {
  if (!folderId) return { ok: true, data: null };
  const folder = await findFolder(scope, folderId);
  return folder ? { ok: true, data: null } : notFound('Dossier de destination introuvable');
}

// --- Reads ---

export function getLimits(): MediaLimitsRecord {
  return {
    maxFileSizeBytes: getMaxFileSizeBytes(),
    allowedMimeTypes: [...MEDIA_ALLOWED_MIME_TYPES],
    storageConfigured: isStorageConfigured(),
  };
}

export async function getFolderContents(
  scope: MediaScopeParams,
  folderId: string | null,
): Promise<LibraryResult<MediaFolderContentsRecord>> {
  let folder: MediaFolder | null = null;
  let breadcrumb: MediaFolderContentsRecord['breadcrumb'] = [];

  if (folderId) {
    folder = await findFolder(scope, folderId);
    if (!folder) return notFound('Dossier introuvable');
    breadcrumb = buildBreadcrumb(await listScopeFolderNodes(scope), folderId).map(({ id, name }) => ({
      id,
      name,
    }));
  }

  const [folders, files] = await Promise.all([
    prisma.mediaFolder.findMany({
      where: { ...scopeWhere(scope), parentId: folderId },
      orderBy: { name: 'asc' },
    }),
    prisma.mediaFile.findMany({
      where: { ...scopeWhere(scope), folderId, status: 'READY' },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    ok: true,
    data: {
      folder: folder ? serializeFolder(folder) : null,
      breadcrumb,
      folders: folders.map(serializeFolder),
      files: await Promise.all(files.map(serializeFile)),
    },
  };
}

export async function getFolderTree(scope: MediaScopeParams): Promise<MediaTreeFolderRecord[]> {
  return listScopeFolderNodes(scope);
}

export async function getDownloadUrl(
  scope: MediaScopeParams,
  fileId: string,
): Promise<LibraryResult<MediaDownloadUrlRecord>> {
  const file = await prisma.mediaFile.findFirst({
    where: { id: fileId, ...scopeWhere(scope), status: 'READY' },
  });
  if (!file) return notFound('Fichier introuvable');
  const signed = await signReadUrl({ key: file.storageKey, fileName: file.name, download: true });
  return { ok: true, data: { url: signed.url, expiresAt: signed.expiresAt.toISOString() } };
}

// --- Folders ---

export async function createFolder(
  scope: MediaScopeParams,
  input: { parentId?: string | null; name: string },
  userId: string,
): Promise<LibraryResult<MediaFolderRecord>> {
  const target = await assertTargetFolder(scope, input.parentId);
  if (!target.ok) return target;
  const folder = await prisma.mediaFolder.create({
    data: {
      ...scopeWhere(scope),
      parentId: input.parentId ?? null,
      name: input.name,
      createdById: userId,
    },
  });
  await notifyMediaChange(scope);
  return { ok: true, data: serializeFolder(folder) };
}

export async function updateFolder(
  scope: MediaScopeParams,
  folderId: string,
  input: { name?: string; parentId?: string | null },
): Promise<LibraryResult<MediaFolderRecord>> {
  const folder = await findFolder(scope, folderId);
  if (!folder) return notFound('Dossier introuvable');

  if (input.parentId !== undefined && input.parentId !== folder.parentId) {
    if (input.parentId) {
      const target = await assertTargetFolder(scope, input.parentId);
      if (!target.ok) return target;
      const nodes = await listScopeFolderNodes(scope);
      if (isSameOrDescendant(nodes, folderId, input.parentId)) {
        return badRequest('Impossible de déplacer un dossier dans lui-même ou dans un de ses sous-dossiers');
      }
    }
  }

  const updated = await prisma.mediaFolder.update({
    where: { id: folderId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    },
  });
  await notifyMediaChange(scope);
  return { ok: true, data: serializeFolder(updated) };
}

/** Deletes the folder, its subfolders and files (database first, then S3 best effort). */
export async function deleteFolder(
  scope: MediaScopeParams,
  folderId: string,
): Promise<LibraryResult<{ deletedFiles: number }>> {
  const folder = await findFolder(scope, folderId);
  if (!folder) return notFound('Dossier introuvable');

  const subtreeIds = collectSubtreeIds(await listScopeFolderNodes(scope), folderId);
  const files = await prisma.mediaFile.findMany({
    where: { ...scopeWhere(scope), folderId: { in: subtreeIds } },
    select: { storageKey: true },
  });

  await prisma.mediaFolder.delete({ where: { id: folderId } });
  await notifyMediaChange(scope);
  await deleteObjects(files.map((file) => file.storageKey));
  return { ok: true, data: { deletedFiles: files.length } };
}

// --- Files ---

export async function createUpload(
  scope: MediaScopeParams,
  input: { folderId?: string | null; name: string; mimeType: string; size: number },
  userId: string,
): Promise<LibraryResult<MediaUploadTicketRecord>> {
  if (!isStorageConfigured()) {
    return { ok: false, status: 503, error: new StorageNotConfiguredError().message };
  }
  const validation = validateUpload(input);
  if (!validation.ok) return badRequest(validation.error);

  const target = await assertTargetFolder(scope, input.folderId);
  if (!target.ok) return target;

  const storageKey = buildStorageKey(scope.scopeType, scope.scopeId);
  const ticket = await createUploadTicket({
    key: storageKey,
    mimeType: input.mimeType,
    maxSizeBytes: getMaxFileSizeBytes(),
  });
  const file = await prisma.mediaFile.create({
    data: {
      ...scopeWhere(scope),
      folderId: input.folderId ?? null,
      name: input.name,
      storageKey,
      mimeType: input.mimeType,
      size: input.size,
      uploadedById: userId,
    },
  });

  return {
    ok: true,
    data: {
      fileId: file.id,
      url: ticket.url,
      fields: ticket.fields,
      expiresAt: ticket.expiresAt.toISOString(),
    },
  };
}

/** Verifies the object really landed in S3 before showing it. */
export async function completeUpload(
  scope: MediaScopeParams,
  fileId: string,
): Promise<LibraryResult<MediaFileRecord>> {
  const file = await prisma.mediaFile.findFirst({ where: { id: fileId, ...scopeWhere(scope) } });
  if (!file) return notFound('Fichier introuvable');
  if (file.status === 'READY') return { ok: true, data: await serializeFile(file) };

  const object = await headObject(file.storageKey);
  if (!object) {
    return badRequest("Le fichier n'a pas été reçu par le stockage, réessayez l'import");
  }
  if (object.contentType !== file.mimeType || object.size <= 0 || object.size > getMaxFileSizeBytes()) {
    await prisma.mediaFile.delete({ where: { id: file.id } });
    await deleteObjects([file.storageKey]);
    return badRequest('Le fichier reçu ne correspond pas à celui annoncé');
  }

  const ready = await prisma.mediaFile.update({
    where: { id: file.id },
    data: { status: 'READY', size: object.size },
  });
  await notifyMediaChange(scope);
  return { ok: true, data: await serializeFile(ready) };
}

export async function updateFile(
  scope: MediaScopeParams,
  fileId: string,
  input: { name?: string; folderId?: string | null },
): Promise<LibraryResult<MediaFileRecord>> {
  const file = await prisma.mediaFile.findFirst({
    where: { id: fileId, ...scopeWhere(scope), status: 'READY' },
  });
  if (!file) return notFound('Fichier introuvable');

  if (input.folderId !== undefined) {
    const target = await assertTargetFolder(scope, input.folderId);
    if (!target.ok) return target;
  }

  const updated = await prisma.mediaFile.update({
    where: { id: fileId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
    },
  });
  await notifyMediaChange(scope);
  return { ok: true, data: await serializeFile(updated) };
}

export async function deleteFile(
  scope: MediaScopeParams,
  fileId: string,
): Promise<LibraryResult<{ success: true }>> {
  const file = await prisma.mediaFile.findFirst({ where: { id: fileId, ...scopeWhere(scope) } });
  if (!file) return notFound('Fichier introuvable');
  await prisma.mediaFile.delete({ where: { id: file.id } });
  await notifyMediaChange(scope);
  await deleteObjects([file.storageKey]);
  return { ok: true, data: { success: true } };
}

/** Removes everything of a tenant (host deleted), including orphan objects. */
export async function purgeScope(scope: MediaScopeParams): Promise<{ files: number; folders: number }> {
  const [files, folders] = await prisma.$transaction([
    prisma.mediaFile.deleteMany({ where: scopeWhere(scope) }),
    prisma.mediaFolder.deleteMany({ where: scopeWhere(scope) }),
  ]);
  await deletePrefix(buildScopePrefix(scope.scopeType, scope.scopeId));
  return { files: files.count, folders: folders.count };
}
