import prisma from '@/lib/prisma';
import type { LetterCorrespondentDTO } from '@/types/letters';

/** Reads shared by the letter actions (never exported from a 'use server' file: they skip the guards). */

export async function loadCorrespondents(boxId: string): Promise<LetterCorrespondentDTO[]> {
  const rows = await prisma.letterCorrespondent.findMany({
    where: { boxId },
    include: {
      _count: { select: { letters: true } },
      letters: {
        orderBy: [{ letterDate: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: { title: true, direction: true },
      },
    },
    // Latest letter first; contacts without letters at the end, by name.
    orderBy: [{ lastLetterAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    note: row.note,
    lastLetterAt: row.lastLetterAt,
    letterCount: row._count.letters,
    lastLetter: row.letters[0] ?? null,
  }));
}

/** Correspondent of the tenant, with its box (for the access check). */
export async function findCorrespondent(businessId: string, id: string) {
  return prisma.letterCorrespondent.findFirst({
    where: { id, box: { businessId } },
    select: { id: true, boxId: true, name: true },
  });
}
