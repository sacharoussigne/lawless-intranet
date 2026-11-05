'use server';

import { getMediaFilesByIds, getMediaLimits } from '@lawless-intranet/media-client/server';
import type { MediaLimitsRecord } from '@lawless-intranet/types';
import { Prisma } from '@prisma/client';
import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { isBusinessAdminRole } from '@/lib/cabinet/access';
import { mediaCookie } from '@/lib/media/client';
import { deleteLetterMediaFiles, lettersMediaScope } from '@/lib/letters/media';
import { findCorrespondent, loadCorrespondents } from '@/lib/letters/queries';
import { emitLetterBoxChanged } from '@/lib/letters/realtime/broadcast';
import { excerptAround, letterTextWhere } from '@/lib/letters/search';
import { generateLetterSerial } from '@/lib/letters/serial';
import { letterInclude, refreshCorrespondentLastLetter, toLetterDTOs } from '@/lib/letters/serialize';
import type {
  LetterBoxSummaryDTO,
  LetterCorrespondentDTO,
  LetterDTO,
  LetterSearchHitDTO,
} from '@/types/letters';
import {
  createLetterSchema,
  letterIdSchema,
  listLettersSchema,
  searchLettersSchema,
  updateLetterSchema,
} from './schemas';
import { getLettersContext, guardLetterBox, type LettersContext } from './internals';

/** A conversation shows its latest letters; older ones are reached with the search. */
const CONVERSATION_LIMIT = 300;
const SEARCH_LIMIT = 30;
const NO_STORAGE: MediaLimitsRecord = { maxFileSizeBytes: 0, allowedMimeTypes: [], storageConfigured: false };

export type LettersPageBootstrap = {
  boxes: LetterBoxSummaryDTO[];
  boxId: string | null;
  canManageMembers: boolean;
  correspondents: LetterCorrespondentDTO[];
  correspondentId: string | null;
  letters: LetterDTO[];
  limits: MediaLimitsRecord;
};

async function loadConversation(
  businessId: string,
  boxId: string,
  correspondentId: string,
  options: { search?: string; includeArchived?: boolean } = {},
): Promise<LetterDTO[]> {
  const rows = await prisma.letter.findMany({
    where: {
      boxId,
      correspondentId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
      ...(options.search ? letterTextWhere(options.search) : {}),
    },
    include: letterInclude,
    orderBy: [{ letterDate: 'desc' }, { createdAt: 'desc' }],
    take: CONVERSATION_LIMIT,
  });
  // Oldest first, like a chat.
  return toLetterDTOs(businessId, rows.reverse());
}

/** Page load: the user's boxes, the chosen box (URL or first), its contacts and the open conversation. */
export async function getLettersPageBootstrap(
  businessSlug: string,
  input: { boxId?: string | null; correspondentId?: string | null } = {},
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const userId = ctx.session.user.id;

    const boxes = await prisma.letterBox.findMany({
      where: { ...tenantWhere(businessId), members: { some: { userId } } },
      select: { id: true, name: true, description: true, members: { where: { userId }, select: { accessLevel: true } } },
      orderBy: { name: 'asc' },
    });
    const summaries: LetterBoxSummaryDTO[] = boxes.flatMap((box) => {
      const level = box.members[0]?.accessLevel;
      return level ? [{ id: box.id, name: box.name, description: box.description, accessLevel: level }] : [];
    });
    const box = summaries.find((entry) => entry.id === input.boxId) ?? summaries[0] ?? null;

    const empty: LettersPageBootstrap = {
      boxes: summaries,
      boxId: box?.id ?? null,
      canManageMembers: false,
      correspondents: [],
      correspondentId: null,
      letters: [],
      limits: NO_STORAGE,
    };
    if (!box) return { status: 200, data: empty };

    const [correspondents, limits] = await Promise.all([
      loadCorrespondents(box.id),
      mediaCookie()
        .then((options) => getMediaLimits(options))
        .catch(() => NO_STORAGE),
    ]);
    const correspondent =
      correspondents.find((entry) => entry.id === input.correspondentId) ?? null;
    const data: LettersPageBootstrap = {
      ...empty,
      canManageMembers:
        box.accessLevel === 'OWNER' || isBusinessAdminRole(ctx.session.user.role, ctx.tenant.effectiveRole),
      correspondents,
      correspondentId: correspondent?.id ?? null,
      letters: correspondent ? await loadConversation(businessId, box.id, correspondent.id) : [],
      limits,
    };
    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des lettres');
  }
}

export async function listLetters(
  businessSlug: string,
  input: { boxId: string; correspondentId: string; search?: string; includeArchived?: boolean },
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = listLettersSchema.parse(input);
    const access = await guardLetterBox(ctx, data.boxId, 'read');
    if (!access.ok) return { status: access.status, error: access.error };
    return {
      status: 200,
      data: await loadConversation(ctx.tenant.businessId, data.boxId, data.correspondentId, data),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des lettres');
  }
}

/** Search of the whole box: matching contacts, then letters (title, transcript, serial). */
export async function searchLetters(
  businessSlug: string,
  input: { boxId: string; query: string; includeArchived?: boolean },
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = searchLettersSchema.parse(input);
    const access = await guardLetterBox(ctx, data.boxId, 'read');
    if (!access.ok) return { status: access.status, error: access.error };

    const [correspondents, letters] = await Promise.all([
      prisma.letterCorrespondent.findMany({
        where: { boxId: data.boxId, name: { contains: data.query, mode: 'insensitive' } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 10,
      }),
      prisma.letter.findMany({
        where: {
          boxId: data.boxId,
          ...(data.includeArchived ? {} : { archivedAt: null }),
          OR: [
            letterTextWhere(data.query),
            { correspondent: { name: { contains: data.query, mode: 'insensitive' } } },
          ],
        },
        include: { correspondent: { select: { name: true } } },
        orderBy: [{ letterDate: 'desc' }, { createdAt: 'desc' }],
        take: SEARCH_LIMIT,
      }),
    ]);
    const hits: LetterSearchHitDTO[] = letters.map((letter) => ({
      id: letter.id,
      correspondentId: letter.correspondentId,
      correspondentName: letter.correspondent.name,
      direction: letter.direction,
      serial: letter.serial,
      title: letter.title,
      letterDate: letter.letterDate,
      archived: letter.archivedAt !== null,
      excerpt: excerptAround(letter.transcript, data.query),
    }));
    return { status: 200, data: { correspondents, letters: hits } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la recherche');
  }
}

type ImageCheck =
  | { ok: true; images: { mediaFileId: string; name: string; mimeType: string; size: number }[] }
  | { ok: false; status: number; error: string };

/** Uploaded files of the letters scope, not yet attached to another letter. */
async function checkLetterImages(
  businessId: string,
  mediaFileIds: string[],
  letterId: string | null,
): Promise<ImageCheck> {
  if (new Set(mediaFileIds).size !== mediaFileIds.length) {
    return { ok: false, status: 400, error: 'Une image est en double' };
  }
  if (mediaFileIds.length === 0) return { ok: true, images: [] };

  const taken = await prisma.letterImage.findFirst({
    where: { mediaFileId: { in: mediaFileIds }, ...(letterId ? { letterId: { not: letterId } } : {}) },
    select: { id: true },
  });
  if (taken) return { ok: false, status: 400, error: 'Une image appartient déjà à une autre lettre' };

  const files = await getMediaFilesByIds(lettersMediaScope(businessId), mediaFileIds, await mediaCookie());
  const byId = new Map(files.map((file) => [file.id, file]));
  if (mediaFileIds.some((id) => !byId.has(id))) {
    return { ok: false, status: 400, error: 'Une image n’a pas fini d’être envoyée, réessayez' };
  }
  return {
    ok: true,
    images: mediaFileIds.flatMap((id) => {
      const file = byId.get(id);
      return file ? [{ mediaFileId: id, name: file.name, mimeType: file.mimeType, size: file.size }] : [];
    }),
  };
}

/** Checks the correspondent and the replied letter belong to the box. */
async function checkLetterLinks(
  ctx: LettersContext,
  boxId: string,
  input: { correspondentId: string; replyToId?: string | null },
  letterId: string | null,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const correspondent = await findCorrespondent(ctx.tenant.businessId, input.correspondentId);
  if (!correspondent || correspondent.boxId !== boxId) {
    return { ok: false, status: 400, error: 'Correspondant introuvable dans cette boîte' };
  }
  if (input.replyToId) {
    if (input.replyToId === letterId) return { ok: false, status: 400, error: 'Une lettre ne peut pas se répondre' };
    const replyTo = await prisma.letter.findFirst({ where: { id: input.replyToId, boxId }, select: { id: true } });
    if (!replyTo) return { ok: false, status: 400, error: 'La lettre d’origine est introuvable' };
  }
  return { ok: true };
}

function isSerialCollision(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function createLetterUnlogged(
  businessSlug: string,
  input: {
    boxId: string;
    correspondentId: string;
    direction: 'RECEIVED' | 'SENT';
    title: string;
    transcript?: string | null;
    letterDate: Date | string;
    replyToId?: string | null;
    images: { mediaFileId: string }[];
  },
  meta?: unknown,
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = createLetterSchema.parse(input);
    const access = await guardLetterBox(ctx, data.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };
    const links = await checkLetterLinks(ctx, data.boxId, data, null);
    if (!links.ok) return { status: links.status, error: links.error };
    const images = await checkLetterImages(
      ctx.tenant.businessId,
      data.images.map((image) => image.mediaFileId),
      null,
    );
    if (!images.ok) return { status: images.status, error: images.error };

    // A random serial can collide with one of the box: draw again (3 tries).
    for (let attempt = 0; ; attempt += 1) {
      try {
        const letter = await prisma.letter.create({
          data: {
            boxId: data.boxId,
            correspondentId: data.correspondentId,
            direction: data.direction,
            serial: generateLetterSerial(),
            title: data.title,
            transcript: data.transcript?.trim() || null,
            letterDate: data.letterDate,
            replyToId: data.replyToId ?? null,
            createdById: ctx.session.user.id,
            images: { create: images.images.map((image, position) => ({ ...image, position })) },
          },
          select: { id: true, serial: true, correspondentId: true },
        });
        await refreshCorrespondentLastLetter(letter.correspondentId);
        emitLetterBoxChanged(data.boxId, meta);
        return { status: 201, data: letter };
      } catch (error) {
        if (!isSerialCollision(error) || attempt >= 2) throw error;
      }
    }
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l’ajout de la lettre');
  }
}

/** Letter of the tenant, with what the checks need. */
async function findLetter(businessId: string, id: string) {
  return prisma.letter.findFirst({
    where: { id, box: tenantWhere(businessId) },
    select: { id: true, boxId: true, correspondentId: true, images: { select: { mediaFileId: true } } },
  });
}

async function updateLetterUnlogged(
  businessSlug: string,
  input: {
    id: string;
    correspondentId: string;
    direction: 'RECEIVED' | 'SENT';
    title: string;
    transcript?: string | null;
    letterDate: Date | string;
    replyToId?: string | null;
    images: { mediaFileId: string }[];
  },
  meta?: unknown,
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = updateLetterSchema.parse(input);
    const letter = await findLetter(ctx.tenant.businessId, data.id);
    if (!letter) return { status: 404, error: 'Lettre introuvable' };
    const access = await guardLetterBox(ctx, letter.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };
    const links = await checkLetterLinks(ctx, letter.boxId, data, letter.id);
    if (!links.ok) return { status: links.status, error: links.error };
    const nextIds = data.images.map((image) => image.mediaFileId);
    const images = await checkLetterImages(ctx.tenant.businessId, nextIds, letter.id);
    if (!images.ok) return { status: images.status, error: images.error };

    await prisma.$transaction([
      prisma.letterImage.deleteMany({ where: { letterId: letter.id } }),
      prisma.letter.update({
        where: { id: letter.id },
        data: {
          correspondentId: data.correspondentId,
          direction: data.direction,
          title: data.title,
          transcript: data.transcript?.trim() || null,
          letterDate: data.letterDate,
          replyToId: data.replyToId ?? null,
          images: { create: images.images.map((image, position) => ({ ...image, position })) },
        },
      }),
    ]);
    const removed = letter.images.map((image) => image.mediaFileId).filter((id) => !nextIds.includes(id));
    await deleteLetterMediaFiles(ctx.tenant.businessId, removed);
    await refreshCorrespondentLastLetter(data.correspondentId);
    if (letter.correspondentId !== data.correspondentId) {
      await refreshCorrespondentLastLetter(letter.correspondentId);
    }
    emitLetterBoxChanged(letter.boxId, meta);
    return { status: 200, data: { id: letter.id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la modification de la lettre');
  }
}

async function setLetterArchived(businessSlug: string, input: { id: string }, archived: boolean, meta?: unknown) {
  const ctx = await getLettersContext(businessSlug);
  if (!ctx.ok) return ctx.response;
  const { id } = letterIdSchema.parse(input);
  const letter = await findLetter(ctx.tenant.businessId, id);
  if (!letter) return { status: 404, error: 'Lettre introuvable' };
  const access = await guardLetterBox(ctx, letter.boxId, 'write');
  if (!access.ok) return { status: access.status, error: access.error };
  await prisma.letter.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  emitLetterBoxChanged(letter.boxId, meta);
  return { status: 200, data: { id } };
}

async function archiveLetterUnlogged(businessSlug: string, input: { id: string }, meta?: unknown) {
  try {
    return await setLetterArchived(businessSlug, input, true, meta);
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l’archivage de la lettre');
  }
}

async function unarchiveLetterUnlogged(businessSlug: string, input: { id: string }, meta?: unknown) {
  try {
    return await setLetterArchived(businessSlug, input, false, meta);
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du désarchivage de la lettre');
  }
}

async function deleteLetterUnlogged(businessSlug: string, input: { id: string }, meta?: unknown) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { id } = letterIdSchema.parse(input);
    const letter = await findLetter(ctx.tenant.businessId, id);
    if (!letter) return { status: 404, error: 'Lettre introuvable' };
    const access = await guardLetterBox(ctx, letter.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };

    await prisma.letter.delete({ where: { id } });
    await deleteLetterMediaFiles(
      ctx.tenant.businessId,
      letter.images.map((image) => image.mediaFileId),
    );
    await refreshCorrespondentLastLetter(letter.correspondentId);
    emitLetterBoxChanged(letter.boxId, meta);
    return { status: 200, data: { id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la lettre');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createLetter(...args: Parameters<typeof createLetterUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letters.createLetter' }, args, () =>
    createLetterUnlogged(...args),
  );
}

export async function updateLetter(...args: Parameters<typeof updateLetterUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letters.updateLetter' }, args, () =>
    updateLetterUnlogged(...args),
  );
}

export async function archiveLetter(...args: Parameters<typeof archiveLetterUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letters.archiveLetter' }, args, () =>
    archiveLetterUnlogged(...args),
  );
}

export async function unarchiveLetter(...args: Parameters<typeof unarchiveLetterUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letters.unarchiveLetter' }, args, () =>
    unarchiveLetterUnlogged(...args),
  );
}

export async function deleteLetter(...args: Parameters<typeof deleteLetterUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letters.deleteLetter' }, args, () =>
    deleteLetterUnlogged(...args),
  );
}
