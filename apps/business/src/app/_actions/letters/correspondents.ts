'use server';

import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { emitLetterBoxChanged } from '@/lib/letters/realtime/broadcast';
import { findCorrespondent, loadCorrespondents } from '@/lib/letters/queries';
import { correspondentSearchName } from '@/lib/letters/search';
import { correspondentSchema, letterIdSchema, updateCorrespondentSchema } from './schemas';
import { getLettersContext, guardLetterBox } from './internals';

export async function listLetterCorrespondents(businessSlug: string, boxId: string) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const access = await guardLetterBox(ctx, boxId, 'read');
    if (!access.ok) return { status: access.status, error: access.error };
    return { status: 200, data: await loadCorrespondents(boxId) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des correspondants');
  }
}

async function createLetterCorrespondentUnlogged(
  businessSlug: string,
  input: { boxId: string; name: string; note?: string | null },
  meta?: unknown,
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = correspondentSchema.parse(input);
    const access = await guardLetterBox(ctx, data.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };

    const existing = await prisma.letterCorrespondent.findFirst({
      where: { boxId: data.boxId, name: { equals: data.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return { status: 409, error: `${data.name} est déjà dans vos correspondants` };

    const created = await prisma.letterCorrespondent.create({
      data: { boxId: data.boxId, name: data.name, searchName: correspondentSearchName(data.name), note: data.note || null },
      select: { id: true, name: true },
    });
    emitLetterBoxChanged(data.boxId, meta);
    return { status: 201, data: created };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l’ajout du correspondant');
  }
}

async function updateLetterCorrespondentUnlogged(
  businessSlug: string,
  input: { id: string; name: string; note?: string | null },
  meta?: unknown,
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = updateCorrespondentSchema.parse(input);
    const correspondent = await findCorrespondent(ctx.tenant.businessId, data.id);
    if (!correspondent) return { status: 404, error: 'Correspondant introuvable' };
    const access = await guardLetterBox(ctx, correspondent.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };

    const duplicate = await prisma.letterCorrespondent.findFirst({
      where: {
        boxId: correspondent.boxId,
        id: { not: data.id },
        name: { equals: data.name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) return { status: 409, error: `${data.name} est déjà dans vos correspondants` };

    await prisma.letterCorrespondent.update({
      where: { id: data.id },
      data: { name: data.name, searchName: correspondentSearchName(data.name), note: data.note || null },
    });
    emitLetterBoxChanged(correspondent.boxId, meta);
    return { status: 200, data: { id: data.id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la modification du correspondant');
  }
}

async function deleteLetterCorrespondentUnlogged(businessSlug: string, input: { id: string }, meta?: unknown) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { id } = letterIdSchema.parse(input);
    const correspondent = await findCorrespondent(ctx.tenant.businessId, id);
    if (!correspondent) return { status: 404, error: 'Correspondant introuvable' };
    const access = await guardLetterBox(ctx, correspondent.boxId, 'write');
    if (!access.ok) return { status: access.status, error: access.error };

    // Letters are never deleted with their correspondent by mistake: delete or move them first.
    const letters = await prisma.letter.count({ where: { correspondentId: id } });
    if (letters > 0) {
      return { status: 409, error: 'Ce correspondant a encore des lettres : supprimez-les d’abord' };
    }
    await prisma.letterCorrespondent.delete({ where: { id } });
    emitLetterBoxChanged(correspondent.boxId, meta);
    return { status: 200, data: { id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du correspondant');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createLetterCorrespondent(...args: Parameters<typeof createLetterCorrespondentUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letterCorrespondents.create' }, args, () =>
    createLetterCorrespondentUnlogged(...args),
  );
}

export async function updateLetterCorrespondent(...args: Parameters<typeof updateLetterCorrespondentUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letterCorrespondents.update' }, args, () =>
    updateLetterCorrespondentUnlogged(...args),
  );
}

export async function deleteLetterCorrespondent(...args: Parameters<typeof deleteLetterCorrespondentUnlogged>) {
  return loggedAction({ feature: 'letters', event: 'letterCorrespondents.delete' }, args, () =>
    deleteLetterCorrespondentUnlogged(...args),
  );
}
