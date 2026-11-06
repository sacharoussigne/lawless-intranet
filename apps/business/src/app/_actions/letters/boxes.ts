'use server';

import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { validateBusinessUserIds } from '@/lib/business/eligibleUsers';
import { enrichRowGroupsWithUsers } from '@/lib/enrichUsers';
import { deleteLetterMediaFiles } from '@/lib/letters/media';
import { emitLetterBoxChanged } from '@/lib/letters/realtime/broadcast';
import type { LetterBoxAdminDTO } from '@/types/letters';
import { createLetterBoxSchema, letterBoxIdSchema, updateLetterBoxSchema } from './schemas';
import { getLettersAdminContext } from './internals';

/** Admin page: every box of the business with its members. */
export async function listLetterBoxesForAdmin(businessSlug: string) {
  try {
    const ctx = await getLettersAdminContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const boxes = await prisma.letterBox.findMany({
      where: tenantWhere(businessId),
      include: { members: { orderBy: { createdAt: 'asc' } }, _count: { select: { letters: true } } },
      orderBy: { name: 'asc' },
    });
    const membersByBox = await enrichRowGroupsWithUsers(
      businessId,
      boxes.map((box) => box.members),
    );
    const data: LetterBoxAdminDTO[] = boxes.map((box, index) => ({
      id: box.id,
      name: box.name,
      description: box.description,
      letterCount: box._count.letters,
      members: (membersByBox[index] ?? []).map((member) => ({
        userId: member.userId,
        accessLevel: member.accessLevel,
        name: member.user.name,
        image: member.user.image,
      })),
    }));
    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des boîtes aux lettres');
  }
}

async function createLetterBoxUnlogged(
  businessSlug: string,
  input: { name: string; description?: string | null; ownerUserId: string },
) {
  try {
    const ctx = await getLettersAdminContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const data = createLetterBoxSchema.parse(input);

    if (!(await validateBusinessUserIds(businessId, [data.ownerUserId]))) {
      return { status: 400, error: 'Le propriétaire doit être membre de l’entreprise' };
    }

    const box = await prisma.letterBox.create({
      data: {
        businessId,
        name: data.name,
        description: data.description || null,
        members: { create: { userId: data.ownerUserId, accessLevel: 'OWNER' } },
      },
      select: { id: true, name: true },
    });
    return { status: 201, data: box };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la boîte aux lettres');
  }
}

async function updateLetterBoxUnlogged(
  businessSlug: string,
  input: { id: string; name: string; description?: string | null },
) {
  try {
    const ctx = await getLettersAdminContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = updateLetterBoxSchema.parse(input);

    const { count } = await prisma.letterBox.updateMany({
      where: { id: data.id, ...tenantWhere(ctx.tenant.businessId) },
      data: { name: data.name, description: data.description || null },
    });
    if (count === 0) return { status: 404, error: 'Boîte aux lettres introuvable' };
    emitLetterBoxChanged(data.id);
    return { status: 200, data: { id: data.id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour de la boîte aux lettres');
  }
}

async function deleteLetterBoxUnlogged(businessSlug: string, input: { id: string }) {
  try {
    const ctx = await getLettersAdminContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const { id } = letterBoxIdSchema.parse(input);

    const box = await prisma.letterBox.findFirst({
      where: { id, ...tenantWhere(businessId) },
      select: { id: true, letters: { select: { images: { select: { mediaFileId: true } } } } },
    });
    if (!box) return { status: 404, error: 'Boîte aux lettres introuvable' };

    await prisma.letterBox.delete({ where: { id } });
    await deleteLetterMediaFiles(
      businessId,
      box.letters.flatMap((letter) => letter.images.map((image) => image.mediaFileId)),
    );
    emitLetterBoxChanged(id);
    return { status: 200, data: { id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la boîte aux lettres');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createLetterBox(...args: Parameters<typeof createLetterBoxUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letterBoxes.createLetterBox' }, args, () =>
    createLetterBoxUnlogged(...args),
  );
}

export async function updateLetterBox(...args: Parameters<typeof updateLetterBoxUnlogged>) {
  return loggedAction(
    { feature: 'letters', event: 'letterBoxes.updateLetterBox', target: ([, data]) => data.id },
    args,
    () => updateLetterBoxUnlogged(...args),
  );
}

export async function deleteLetterBox(...args: Parameters<typeof deleteLetterBoxUnlogged>) {
  return loggedAction(
    { feature: 'letters', event: 'letterBoxes.deleteLetterBox', target: ([, data]) => data.id },
    args,
    () => deleteLetterBoxUnlogged(...args),
  );
}
