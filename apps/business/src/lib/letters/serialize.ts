import { getMediaFilesByIds } from '@lawless-intranet/media-client/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { mediaCookie } from '@/lib/media/client';
import { fetchBusinessUserProfiles } from '@/lib/people/userProfiles';
import type { LetterDTO } from '@/types/letters';
import { lettersMediaScope } from './media';

export const letterInclude = {
  images: { orderBy: { position: 'asc' } },
  replyTo: { select: { id: true, serial: true, title: true, direction: true } },
} satisfies Prisma.LetterInclude;

type LetterRow = Prisma.LetterGetPayload<{ include: typeof letterInclude }>;

/** Letters with author names and image previews: one profile call and one media call for the whole page. */
export async function toLetterDTOs(businessId: string, rows: LetterRow[]): Promise<LetterDTO[]> {
  if (rows.length === 0) return [];
  const fileIds = rows.flatMap((row) => row.images.map((image) => image.mediaFileId));
  const [profiles, files] = await Promise.all([
    fetchBusinessUserProfiles(businessId, [...new Set(rows.map((row) => row.createdById))]),
    fileIds.length > 0
      ? getMediaFilesByIds(lettersMediaScope(businessId), fileIds, await mediaCookie()).catch((error: unknown) => {
          // The letters stay readable without their images (media service down, storage not configured).
          console.error('Letters: image previews unavailable', error);
          return [];
        })
      : [],
  ]);
  const previewById = new Map(files.map((file) => [file.id, file.previewUrl]));

  return rows.map((row) => ({
    id: row.id,
    correspondentId: row.correspondentId,
    direction: row.direction,
    serial: row.serial,
    title: row.title,
    transcript: row.transcript,
    letterDate: row.letterDate,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    createdBy: { id: row.createdById, name: profiles.get(row.createdById)?.name ?? 'Inconnu' },
    replyTo: row.replyTo,
    images: row.images.map((image) => ({
      id: image.id,
      mediaFileId: image.mediaFileId,
      name: image.name,
      mimeType: image.mimeType,
      size: image.size,
      previewUrl: previewById.get(image.mediaFileId) ?? null,
    })),
  }));
}

/** Keeps the contact list order (latest letter first) without an aggregate on every read. */
export async function refreshCorrespondentLastLetter(correspondentId: string): Promise<void> {
  const latest = await prisma.letter.aggregate({
    where: { correspondentId },
    _max: { letterDate: true },
  });
  await prisma.letterCorrespondent.update({
    where: { id: correspondentId },
    data: { lastLetterAt: latest._max.letterDate },
  });
}
