'use server';

import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { searchEligibleBusinessUsers, validateBusinessUserIds } from '@/lib/business/eligibleUsers';
import { isBusinessAdminRole } from '@/lib/cabinet/access';
import { enrichAgendaMembers } from '@/lib/enrichUsers';
import { canManageLetterBoxMembers } from '@/lib/letters/access';
import { emitLetterBoxChanged } from '@/lib/letters/realtime/broadcast';
import type { LetterBoxMemberDTO } from '@/types/letters';
import { removeLetterBoxMemberSchema, upsertLetterBoxMemberSchema } from './schemas';
import { getLettersContext, guardLetterBox, type LettersContext } from './internals';

async function guardMemberManagement(ctx: LettersContext, boxId: string) {
  const box = await prisma.letterBox.findFirst({
    where: { id: boxId, ...tenantWhere(ctx.tenant.businessId) },
    select: { id: true },
  });
  if (!box) return { ok: false as const, status: 404, error: 'Boîte aux lettres introuvable' };
  const allowed = await canManageLetterBoxMembers(
    boxId,
    ctx.session.user.id,
    ctx.session.user.role,
    ctx.tenant.effectiveRole,
  );
  if (!allowed) return { ok: false as const, status: 403, error: 'Seul le propriétaire gère les accès' };
  return { ok: true as const };
}

/** Members of a box: readable by its members, and by those who manage it (owner, admin). */
export async function getLetterBoxMembers(businessSlug: string, boxId: string) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const manage = await guardMemberManagement(ctx, boxId);
    if (!manage.ok) {
      const read = await guardLetterBox(ctx, boxId, 'read');
      if (!read.ok) return { status: read.status, error: read.error };
    }

    const members = await prisma.letterBoxMember.findMany({
      where: { boxId },
      orderBy: { createdAt: 'asc' },
    });
    const enriched = await enrichAgendaMembers(ctx.tenant.businessId, members);
    const data: LetterBoxMemberDTO[] = enriched.map((member) => ({
      userId: member.userId,
      accessLevel: member.accessLevel,
      name: member.user.name,
      image: member.user.image,
    }));
    return { status: 200, data: { members: data, canManage: manage.ok } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des accès');
  }
}

/** People who can be given access: business members (and platform admins). */
export async function searchLetterBoxUsers(
  businessSlug: string,
  input: { boxId?: string; query: string },
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    // Picking a box owner (admin page) or a member (owner of the box).
    if (input.boxId) {
      const manage = await guardMemberManagement(ctx, input.boxId);
      if (!manage.ok) return { status: manage.status, error: manage.error };
    } else if (!isBusinessAdminRole(ctx.session.user.role, ctx.tenant.effectiveRole)) {
      return { status: 403, error: 'Droits administrateur requis' };
    }
    return { status: 200, data: await searchEligibleBusinessUsers(ctx.tenant.businessId, input.query) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la recherche');
  }
}

async function upsertLetterBoxMemberUnlogged(
  businessSlug: string,
  input: { boxId: string; userId: string; accessLevel: 'OWNER' | 'WRITE' | 'READ' },
  meta?: unknown,
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = upsertLetterBoxMemberSchema.parse(input);
    const manage = await guardMemberManagement(ctx, data.boxId);
    if (!manage.ok) return { status: manage.status, error: manage.error };

    if (!(await validateBusinessUserIds(ctx.tenant.businessId, [data.userId]))) {
      return { status: 400, error: 'Cette personne n’est pas membre de l’entreprise' };
    }
    // The last owner cannot step down: the box would have nobody to manage it.
    if (data.accessLevel !== 'OWNER') {
      const current = await prisma.letterBoxMember.findUnique({
        where: { boxId_userId: { boxId: data.boxId, userId: data.userId } },
        select: { accessLevel: true },
      });
      if (current?.accessLevel === 'OWNER') {
        const owners = await prisma.letterBoxMember.count({ where: { boxId: data.boxId, accessLevel: 'OWNER' } });
        if (owners <= 1) return { status: 400, error: 'La boîte doit garder au moins un propriétaire' };
      }
    }

    await prisma.letterBoxMember.upsert({
      where: { boxId_userId: { boxId: data.boxId, userId: data.userId } },
      create: { boxId: data.boxId, userId: data.userId, accessLevel: data.accessLevel },
      update: { accessLevel: data.accessLevel },
    });
    emitLetterBoxChanged(data.boxId, meta);
    return { status: 200, data: { boxId: data.boxId, userId: data.userId } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour de l’accès');
  }
}

async function removeLetterBoxMemberUnlogged(
  businessSlug: string,
  input: { boxId: string; userId: string },
  meta?: unknown,
) {
  try {
    const ctx = await getLettersContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const data = removeLetterBoxMemberSchema.parse(input);
    const manage = await guardMemberManagement(ctx, data.boxId);
    if (!manage.ok) return { status: manage.status, error: manage.error };

    const target = await prisma.letterBoxMember.findUnique({
      where: { boxId_userId: { boxId: data.boxId, userId: data.userId } },
      select: { accessLevel: true },
    });
    if (!target) return { status: 404, error: 'Accès introuvable' };
    if (target.accessLevel === 'OWNER') {
      const owners = await prisma.letterBoxMember.count({ where: { boxId: data.boxId, accessLevel: 'OWNER' } });
      if (owners <= 1) return { status: 400, error: 'La boîte doit garder au moins un propriétaire' };
    }

    await prisma.letterBoxMember.delete({
      where: { boxId_userId: { boxId: data.boxId, userId: data.userId } },
    });
    emitLetterBoxChanged(data.boxId, meta);
    return { status: 200, data: { boxId: data.boxId, userId: data.userId } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du retrait de l’accès');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function upsertLetterBoxMember(...args: Parameters<typeof upsertLetterBoxMemberUnlogged>) {
  return loggedAction(
    { feature: 'letters', event: 'letterBoxes.upsertMember', target: ([, data]) => data.boxId },
    args,
    () => upsertLetterBoxMemberUnlogged(...args),
  );
}

export async function removeLetterBoxMember(...args: Parameters<typeof removeLetterBoxMemberUnlogged>) {
  return loggedAction(
    { feature: 'letters', event: 'letterBoxes.removeMember', target: ([, data]) => data.boxId },
    args,
    () => removeLetterBoxMemberUnlogged(...args),
  );
}
