'use server';

import { completeMediaUpload, createMediaUpload, getMediaDownloadUrl } from '@lawless-intranet/media-client/server';
import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { mediaCookie } from '@/lib/media/client';
import { serviceActionError } from '@/lib/serviceAction';
import { deleteLetterMediaFiles, lettersMediaScope } from '@/lib/letters/media';
import { completeLetterImageUploadSchema, requestLetterImageUploadSchema } from './schemas';
import { getLettersContext, guardLetterBox } from './internals';

/*
 * Letter images go straight from the browser to the storage (presigned POST), like the
 * media library, but in the letters scope. They are attached to a letter when it is saved.
 */

async function requestLetterImageUploadUnlogged(
  businessSlug: string,
  input: { boxId: string; name: string; mimeType: string; size: number },
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = requestLetterImageUploadSchema.parse(input);
    const access = await guardLetterBox(ctx, data.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };
    const ticket = await createMediaUpload(
      lettersMediaScope(ctx.tenant.businessId),
      { folderId: null, name: data.name, mimeType: data.mimeType, size: data.size },
      await mediaCookie(),
    );
    return { status: 201, data: ticket };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de l’envoi de l’image', { feature: 'letters' });
  }
}

async function completeLetterImageUploadUnlogged(
  businessSlug: string,
  input: { boxId: string; fileId: string },
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = completeLetterImageUploadSchema.parse(input);
    const access = await guardLetterBox(ctx, data.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };
    const file = await completeMediaUpload(
      lettersMediaScope(ctx.tenant.businessId),
      data.fileId,
      await mediaCookie(),
    );
    return { status: 200, data: file };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de l’envoi de l’image', { feature: 'letters' });
  }
}

/** Image removed from the form before saving: deleted unless a letter already uses it. */
async function discardLetterImageUploadUnlogged(
  businessSlug: string,
  input: { boxId: string; fileId: string },
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = completeLetterImageUploadSchema.parse(input);
    const access = await guardLetterBox(ctx, data.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };
    const attached = await prisma.letterImage.findUnique({
      where: { mediaFileId: data.fileId },
      select: { id: true },
    });
    // Attached images are removed by saving the letter without them.
    if (!attached) await deleteLetterMediaFiles(ctx.tenant.businessId, [data.fileId]);
    return { status: 200, data: { fileId: data.fileId } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du retrait de l’image', { feature: 'letters' });
  }
}

/** Download link of an image of a letter of the box (signed, forces the download). */
export async function getLetterImageDownloadUrl(businessSlug: string, input: { boxId: string; fileId: string }) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = completeLetterImageUploadSchema.parse(input);
    const access = await guardLetterBox(ctx, data.boxId, 'read');
    if (!access.ok) return { status: access.status, error: access.error };
    const image = await prisma.letterImage.findFirst({
      where: { mediaFileId: data.fileId, letter: { boxId: data.boxId } },
      select: { id: true },
    });
    if (!image) return { status: 404, error: 'Image introuvable' };
    return {
      status: 200,
      data: await getMediaDownloadUrl(lettersMediaScope(ctx.tenant.businessId), data.fileId, await mediaCookie()),
    };
  } catch (error) {
    return serviceActionError(error, 'Téléchargement impossible', { feature: 'letters' });
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function requestLetterImageUpload(...args: Parameters<typeof requestLetterImageUploadUnlogged>) {
  return loggedAction(
    { feature: 'letters', event: 'letterImages.requestUpload', target: ([, data]) => data.boxId },
    args,
    () => requestLetterImageUploadUnlogged(...args),
  );
}

export async function completeLetterImageUpload(...args: Parameters<typeof completeLetterImageUploadUnlogged>) {
  return loggedAction(
    { feature: 'letters', event: 'letterImages.completeUpload', target: ([, data]) => data.fileId },
    args,
    () => completeLetterImageUploadUnlogged(...args),
  );
}

export async function discardLetterImageUpload(...args: Parameters<typeof discardLetterImageUploadUnlogged>) {
  return loggedAction(
    { feature: 'letters', event: 'letterImages.discardUpload', target: ([, data]) => data.fileId },
    args,
    () => discardLetterImageUploadUnlogged(...args),
  );
}
