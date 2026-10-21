'use server';

import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { canManageCabinetMembers } from '@/lib/cabinet/access';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';
import {
  upsertCabinetMemberSchema,
  removeCabinetMemberSchema,
} from '@/app/_actions/cabinet/schemas';
import {
  getCabinetSessionContext,
  searchEligibleBusinessUsersForCabinet,
  validateBusinessUserIds,
} from '@/app/_actions/cabinet/internals';
import { enrichAgendaMembers } from '@/lib/enrichUsers';

async function upsertCabinetMemberUnlogged(
  businessSlug: string,
  data: { cabinetId: string; userId: string; accessLevel: 'OWNER' | 'WRITE' | 'READ' },
) {
  try {
    const ctx = await getCabinetSessionContext(businessSlug);
    if (!ctx.ok) return ctx.response;

    const validated = upsertCabinetMemberSchema.parse(data);

    const canManage = await canManageCabinetMembers(
      ctx.tenant.businessId,
      validated.cabinetId,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    if (!canManage) {
      return { status: 403, error: 'Droits insuffisants pour gérer les membres' };
    }

    const cabinet = await prisma.cabinet.findFirst({
      where: { id: validated.cabinetId, ...tenantWhere(ctx.tenant.businessId) },
      select: { id: true },
    });
    if (!cabinet) {
      return { status: 404, error: 'Cabinet introuvable' };
    }

    const validUser = await validateBusinessUserIds(ctx.tenant.businessId, [
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

    const [enriched] = await enrichAgendaMembers(ctx.tenant.businessId, [member]);

    return { status: 200, data: enriched };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du membre');
  }
}

async function removeCabinetMemberUnlogged(
  businessSlug: string,
  data: { cabinetId: string; userId: string },
) {
  try {
    const ctx = await getCabinetSessionContext(businessSlug);
    if (!ctx.ok) return ctx.response;

    const validated = removeCabinetMemberSchema.parse(data);

    const canManage = await canManageCabinetMembers(
      ctx.tenant.businessId,
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

export async function searchBusinessUsersForCabinet(
  businessSlug: string,
  query: string,
  options?: { adminContext?: boolean },
) {
  try {
    let businessId: string;

    if (options?.adminContext) {
      const auth = await requireBusinessAdminContext(businessSlug);
      if (!auth.ok) {
        return { status: auth.status, error: auth.error };
      }
      businessId = auth.ctx.businessId;
    } else {
      const ctx = await getCabinetSessionContext(businessSlug);
      if (!ctx.ok) return ctx.response;
      businessId = ctx.tenant.businessId;
    }

    const data = await searchEligibleBusinessUsersForCabinet(businessId, query);

    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la recherche');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function upsertCabinetMember(...args: Parameters<typeof upsertCabinetMemberUnlogged>) {
  return loggedAction(
    {
      feature: 'cabinet',
      event: 'members.upsertCabinetMember',
      target: ([, data]) => data.cabinetId,
    },
    args,
    () => upsertCabinetMemberUnlogged(...args),
  );
}

export async function removeCabinetMember(...args: Parameters<typeof removeCabinetMemberUnlogged>) {
  return loggedAction(
    {
      feature: 'cabinet',
      event: 'members.removeCabinetMember',
      target: ([, data]) => data.cabinetId,
    },
    args,
    () => removeCabinetMemberUnlogged(...args),
  );
}
