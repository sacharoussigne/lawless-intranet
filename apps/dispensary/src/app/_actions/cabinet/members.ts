'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { canManageCabinetMembers } from '@/lib/cabinet/access';
import { requireDispensaryAdminContext } from '@/lib/dispensary/serverActionContext';
import {
  upsertCabinetMemberSchema,
  removeCabinetMemberSchema,
} from '@/app/_actions/cabinet/schemas';
import {
  getCabinetSessionContext,
  searchEligibleDispensaryUsersForCabinet,
  validateDispensaryUserIds,
} from '@/app/_actions/cabinet/internals';
import { enrichAgendaMembers } from '@/lib/enrichUsers';

export async function upsertCabinetMember(
  dispensarySlug: string,
  data: { cabinetId: string; userId: string; accessLevel: 'OWNER' | 'WRITE' | 'READ' },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = upsertCabinetMemberSchema.parse(data);

    const canManage = await canManageCabinetMembers(
      ctx.tenant.dispensaryId,
      validated.cabinetId,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    if (!canManage) {
      return { status: 403, error: 'Droits insuffisants pour gérer les membres' };
    }

    const cabinet = await prisma.cabinet.findFirst({
      where: { id: validated.cabinetId, ...tenantWhere(ctx.tenant.dispensaryId) },
      select: { id: true },
    });
    if (!cabinet) {
      return { status: 404, error: 'Cabinet introuvable' };
    }

    const validUser = await validateDispensaryUserIds(ctx.tenant.dispensaryId, [
      validated.userId,
    ]);
    if (!validUser) {
      return { status: 400, error: 'Utilisateur non membre du dispensaire' };
    }

    const member = await prisma.cabinetMember.upsert({
      where: {
        cabinetId_userId: {
          cabinetId: validated.cabinetId,
          userId: validated.userId,
        },
      },
      create: {
        cabinetId: validated.cabinetId,
        userId: validated.userId,
        accessLevel: validated.accessLevel,
      },
      update: { accessLevel: validated.accessLevel },
    });

    const [enriched] = await enrichAgendaMembers([member]);

    return { status: 200, data: enriched };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du membre');
  }
}

export async function removeCabinetMember(
  dispensarySlug: string,
  data: { cabinetId: string; userId: string },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = removeCabinetMemberSchema.parse(data);

    const canManage = await canManageCabinetMembers(
      ctx.tenant.dispensaryId,
      validated.cabinetId,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    if (!canManage) {
      return { status: 403, error: 'Droits insuffisants pour gérer les membres' };
    }

    const ownerCount = await prisma.cabinetMember.count({
      where: {
        cabinetId: validated.cabinetId,
        accessLevel: 'OWNER',
      },
    });

    const target = await prisma.cabinetMember.findUnique({
      where: {
        cabinetId_userId: {
          cabinetId: validated.cabinetId,
          userId: validated.userId,
        },
      },
    });

    if (!target) {
      return { status: 404, error: 'Membre introuvable' };
    }

    if (target.accessLevel === 'OWNER' && ownerCount <= 1) {
      return {
        status: 400,
        error: 'Impossible de retirer le dernier propriétaire',
      };
    }

    await prisma.cabinetMember.delete({
      where: {
        cabinetId_userId: {
          cabinetId: validated.cabinetId,
          userId: validated.userId,
        },
      },
    });

    return { status: 200 };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du membre');
  }
}

export async function searchDispensaryUsersForCabinet(
  dispensarySlug: string,
  query: string,
  options?: { adminContext?: boolean },
) {
  try {
    let dispensaryId: string;

    if (options?.adminContext) {
      const auth = await requireDispensaryAdminContext(dispensarySlug);
      if (!auth.ok) {
        return { status: auth.status, error: auth.error };
      }
      dispensaryId = auth.ctx.dispensaryId;
    } else {
      const ctx = await getCabinetSessionContext(dispensarySlug);
      if (!ctx.ok) return ctx.response;
      dispensaryId = ctx.tenant.dispensaryId;
    }

    const data = await searchEligibleDispensaryUsersForCabinet(dispensaryId, query);

    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la recherche');
  }
}
