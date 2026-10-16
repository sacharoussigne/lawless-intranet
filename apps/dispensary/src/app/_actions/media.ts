'use server';

import { fetchDispensaryUserProfiles } from '@/lib/people/userProfiles';
import { loggedAction } from '@/lib/logs/writer';
import { z } from 'zod/v3';
import {
  completeMediaUpload,
  createMediaFolder,
  createMediaUpload,
  deleteMediaFile,
  deleteMediaFolder,
  deleteMediaItems,
  getMediaDownloadUrl,
  getMediaFolderContents,
  getMediaFolderTree,
  getMediaLimits,
  moveMediaItems,
  shareMediaFile,
  unshareMediaFile,
  updateMediaFile,
  updateMediaFolder,
} from '@lawless-intranet/media-client/server';
import { actionErrorParser } from '@/lib/action';
import { mediaActionAuth } from '@/lib/media/auth';
import { mediaCookie, mediaScope } from '@/lib/media/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { withTenantService } from '@/lib/serviceAction';

// Names and limits are fully validated by the media service; the host only checks shapes.
const idSchema = z.string().uuid();
const nullableIdSchema = idSchema.nullable();
const nameSchema = z.string().trim().min(1, 'Le nom est requis').max(255, 'Le nom est trop long');
const itemsSchema = z.object({
  folderIds: z.array(idSchema).max(1000),
  fileIds: z.array(idSchema).max(1000),
});

/** Runs a media operation for the current dispensary, with the shared guard and error mapping. */
function withMedia<T>(
  dispensarySlug: string,
  fallback: string,
  run: (scope: ReturnType<typeof mediaScope>, options: Awaited<ReturnType<typeof mediaCookie>>) => Promise<T>,
) {
  return withTenantService(dispensarySlug, mediaActionAuth, fallback, async (dispensaryId) =>
    run(mediaScope(dispensaryId), await mediaCookie()),
  );
}

export async function getMediaLibraryLimits(dispensarySlug: string) {
  return withMedia(dispensarySlug, 'Erreur lors du chargement de la médiathèque', (_scope, options) =>
    getMediaLimits(options),
  );
}

export async function getMediaContents(dispensarySlug: string, folderId: string | null) {
  return withMedia(dispensarySlug, 'Erreur lors du chargement du dossier', (scope, options) =>
    getMediaFolderContents(scope, nullableIdSchema.parse(folderId), options),
  );
}

export async function getMediaTree(dispensarySlug: string) {
  return withMedia(dispensarySlug, 'Erreur lors du chargement des dossiers', (scope, options) =>
    getMediaFolderTree(scope, options),
  );
}

async function createMediaLibraryFolderUnlogged(
  dispensarySlug: string,
  input: { parentId: string | null; name: string },
) {
  return withMedia(dispensarySlug, 'Erreur lors de la création du dossier', (scope, options) => {
    const data = z.object({ parentId: nullableIdSchema, name: nameSchema }).parse(input);
    return createMediaFolder(scope, data, options);
  });
}

async function updateMediaLibraryFolderUnlogged(
  dispensarySlug: string,
  input: { id: string; name?: string; parentId?: string | null },
) {
  return withMedia(dispensarySlug, 'Erreur lors de la modification du dossier', (scope, options) => {
    const { id, ...data } = z
      .object({ id: idSchema, name: nameSchema.optional(), parentId: nullableIdSchema.optional() })
      .parse(input);
    return updateMediaFolder(scope, id, data, options);
  });
}

async function deleteMediaLibraryFolderUnlogged(dispensarySlug: string, id: string) {
  return withMedia(dispensarySlug, 'Erreur lors de la suppression du dossier', (scope, options) =>
    deleteMediaFolder(scope, idSchema.parse(id), options),
  );
}

async function requestMediaUploadUnlogged(
  dispensarySlug: string,
  input: { folderId: string | null; name: string; mimeType: string; size: number },
) {
  return withMedia(dispensarySlug, "Erreur lors de la préparation de l'import", (scope, options) => {
    const data = z
      .object({
        folderId: nullableIdSchema,
        name: nameSchema,
        mimeType: z.string().min(1).max(128),
        size: z.number().int().positive(),
      })
      .parse(input);
    return createMediaUpload(scope, data, options);
  });
}

async function completeMediaLibraryUploadUnlogged(dispensarySlug: string, fileId: string) {
  return withMedia(dispensarySlug, "Erreur lors de la finalisation de l'import", (scope, options) =>
    completeMediaUpload(scope, idSchema.parse(fileId), options),
  );
}

async function updateMediaLibraryFileUnlogged(
  dispensarySlug: string,
  input: { id: string; name?: string; folderId?: string | null },
) {
  return withMedia(dispensarySlug, 'Erreur lors de la modification du fichier', (scope, options) => {
    const { id, ...data } = z
      .object({ id: idSchema, name: nameSchema.optional(), folderId: nullableIdSchema.optional() })
      .parse(input);
    return updateMediaFile(scope, id, data, options);
  });
}

async function deleteMediaLibraryFileUnlogged(dispensarySlug: string, id: string) {
  return withMedia(dispensarySlug, 'Erreur lors de la suppression du fichier', (scope, options) =>
    deleteMediaFile(scope, idSchema.parse(id), options),
  );
}

export async function getMediaLibraryDownloadUrl(dispensarySlug: string, id: string) {
  return withMedia(dispensarySlug, 'Erreur lors du téléchargement', (scope, options) =>
    getMediaDownloadUrl(scope, idSchema.parse(id), options),
  );
}

async function shareMediaLibraryFileUnlogged(dispensarySlug: string, id: string) {
  return withMedia(dispensarySlug, 'Erreur lors du partage du fichier', (scope, options) =>
    shareMediaFile(scope, idSchema.parse(id), options),
  );
}

async function unshareMediaLibraryFileUnlogged(dispensarySlug: string, id: string) {
  return withMedia(dispensarySlug, 'Erreur lors de la désactivation du lien', (scope, options) =>
    unshareMediaFile(scope, idSchema.parse(id), options),
  );
}

async function moveMediaLibraryItemsUnlogged(
  dispensarySlug: string,
  input: { folderIds: string[]; fileIds: string[]; destinationId: string | null },
) {
  return withMedia(dispensarySlug, 'Erreur lors du déplacement', (scope, options) => {
    const data = itemsSchema.extend({ destinationId: nullableIdSchema }).parse(input);
    return moveMediaItems(scope, data, options);
  });
}

async function deleteMediaLibraryItemsUnlogged(
  dispensarySlug: string,
  input: { folderIds: string[]; fileIds: string[] },
) {
  return withMedia(dispensarySlug, 'Erreur lors de la suppression', (scope, options) =>
    deleteMediaItems(scope, itemsSchema.parse(input), options),
  );
}

/** Uploader name for « Informations » (null when the account no longer exists). */
export async function getMediaUserName(dispensarySlug: string, userId: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, mediaActionAuth);
    if (!ctx.ok) return ctx.response;
    const id = z.string().min(1).max(255).parse(userId);
    const profile = (await fetchDispensaryUserProfiles(ctx.tenant.dispensaryId, [id])).get(id);
    return { status: 200, data: profile?.name ?? null };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de l’utilisateur');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createMediaLibraryFolder(
  ...args: Parameters<typeof createMediaLibraryFolderUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.createMediaLibraryFolder' }, args, () =>
    createMediaLibraryFolderUnlogged(...args),
  );
}

export async function updateMediaLibraryFolder(
  ...args: Parameters<typeof updateMediaLibraryFolderUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.updateMediaLibraryFolder' }, args, () =>
    updateMediaLibraryFolderUnlogged(...args),
  );
}

export async function deleteMediaLibraryFolder(
  ...args: Parameters<typeof deleteMediaLibraryFolderUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.deleteMediaLibraryFolder' }, args, () =>
    deleteMediaLibraryFolderUnlogged(...args),
  );
}

export async function requestMediaUpload(...args: Parameters<typeof requestMediaUploadUnlogged>) {
  return loggedAction(
    {
      feature: 'media',
      event: 'media.requestMediaUpload',
      target: (_args, result) => (result && 'data' in result ? result.data?.fileId : null),
    },
    args,
    () => requestMediaUploadUnlogged(...args),
  );
}

export async function completeMediaLibraryUpload(
  ...args: Parameters<typeof completeMediaLibraryUploadUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.completeMediaLibraryUpload' }, args, () =>
    completeMediaLibraryUploadUnlogged(...args),
  );
}

export async function updateMediaLibraryFile(
  ...args: Parameters<typeof updateMediaLibraryFileUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.updateMediaLibraryFile' }, args, () =>
    updateMediaLibraryFileUnlogged(...args),
  );
}

export async function deleteMediaLibraryFile(
  ...args: Parameters<typeof deleteMediaLibraryFileUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.deleteMediaLibraryFile' }, args, () =>
    deleteMediaLibraryFileUnlogged(...args),
  );
}

export async function shareMediaLibraryFile(
  ...args: Parameters<typeof shareMediaLibraryFileUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.shareMediaLibraryFile' }, args, () =>
    shareMediaLibraryFileUnlogged(...args),
  );
}

export async function unshareMediaLibraryFile(
  ...args: Parameters<typeof unshareMediaLibraryFileUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.unshareMediaLibraryFile' }, args, () =>
    unshareMediaLibraryFileUnlogged(...args),
  );
}

export async function moveMediaLibraryItems(
  ...args: Parameters<typeof moveMediaLibraryItemsUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.moveMediaLibraryItems' }, args, () =>
    moveMediaLibraryItemsUnlogged(...args),
  );
}

export async function deleteMediaLibraryItems(
  ...args: Parameters<typeof deleteMediaLibraryItemsUnlogged>
) {
  return loggedAction({ feature: 'media', event: 'media.deleteMediaLibraryItems' }, args, () =>
    deleteMediaLibraryItemsUnlogged(...args),
  );
}
