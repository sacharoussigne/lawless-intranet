'use server';

import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';
import { tenantWhere } from '@/lib/business/tenantWhere';
import {
  isBusinessAdminRole,
  listAccessibleCabinetIds,
  userHasAnyCabinetAccess,
  canManageCabinetMembers,
} from '@/lib/cabinet/access';
import type { CabinetSummaryDTO } from '@/types/cabinet';
import {
  createCabinetSchema,
  updateCabinetSchema,
  deleteCabinetSchema,
} from '@/app/_actions/cabinet/schemas';
import {
  getCabinetSessionContext,
  guardCabinetOwner,
  guardCabinetRead,
  validateBusinessUserIds,
} from '@/app/_actions/cabinet/internals';
import { enrichAgendaMembers, enrichRowGroupsWithUsers } from '@/lib/enrichUsers';
import { createDefaultFormSchemas } from '@/lib/cabinet/formSchema';

const cabinetIncludeMembers = {
  members: {
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { members: true, patients: true } },
};

export async function listCabinetsForAdmin(businessSlug: string) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const cabinets = await prisma.cabinet.findMany({
      where: tenantWhere(auth.ctx.businessId),
      include: cabinetIncludeMembers,
      orderBy: { name: 'asc' },
    });

    const membersByCabinet = await enrichRowGroupsWithUsers(
      auth.ctx.businessId,
      cabinets.map((cabinet) => cabinet.members),
    );
    const enriched = cabinets.map((cabinet, index) => ({
      ...cabinet,
      members: membersByCabinet[index] ?? [],
    }));

    return { status: 200, data: enriched };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des cabinets');
  }
}

export async function getCabinetPageBootstrap(businessSlug: string) {
  try {
    const ctx = await getCabinetSessionContext(businessSlug);
    if (!ctx.ok) return ctx.response;

    const { businessId, effectiveRole } = ctx.tenant;
    const { session } = ctx;

    const hasAccess = await userHasAnyCabinetAccess(businessId, session.user.id);
    const isAdmin = isBusinessAdminRole(session.user.role, effectiveRole);

    if (!hasAccess) {
      return {
        status: 200,
        data: { hasAccess: false, isAdmin, cabinets: [] as CabinetSummaryDTO[] },
      };
    }

    const cabinetIds = await listAccessibleCabinetIds(businessId, session.user.id);

    if (cabinetIds.length === 0) {
      return {
        status: 200,
        data: { hasAccess: true, isAdmin, cabinets: [] as CabinetSummaryDTO[] },
      };
    }

    const cabinets = await prisma.cabinet.findMany({
      where: { id: { in: cabinetIds }, ...tenantWhere(businessId) },
      include: {
        members: {
          where: { userId: session.user.id },
          select: { accessLevel: true },
        },
        _count: { select: { members: true, patients: true } },
      },
      orderBy: { name: 'asc' },
    });

    const data: CabinetSummaryDTO[] = cabinets.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      accessLevel: c.members[0]?.accessLevel ?? null,
      memberCount: c._count.members,
      patientCount: c._count.patients,
    }));

    return { status: 200, data: { hasAccess: true, isAdmin, cabinets: data } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de la page cabinet');
  }
}

async function createCabinetUnlogged(
  businessSlug: string,
  data: { name: string; description?: string | null; ownerUserId: string },
) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = createCabinetSchema.parse(data);

    const validOwner = await validateBusinessUserIds(auth.ctx.businessId, [
      validated.ownerUserId,
    ]);

    if (!validOwner) {
      return {
        status: 400,
        error: 'Le propriétaire doit avoir accès au dispensaire',
      };
    }

    const defaultSchemas = createDefaultFormSchemas();

    const cabinet = await prisma.$transaction(async (tx) => {
      const created = await tx.cabinet.create({
        data: {
          businessId: auth.ctx.businessId,
          name: validated.name,
          description: validated.description ?? null,
          formSchemas: defaultSchemas as object,
          displaySettings: {} as object,
        },
      });

      await tx.cabinetMember.create({
        data: {
          cabinetId: created.id,
          userId: validated.ownerUserId,
          accessLevel: 'OWNER',
        },
      });

      return created;
    });

    return { status: 201, data: cabinet };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création du cabinet');
  }
}

async function updateCabinetUnlogged(
  businessSlug: string,
  data: { id: string; name: string; description?: string | null },
) {
  try {
    const ctx = await getCabinetSessionContext(businessSlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateCabinetSchema.parse(data);
    const isAdmin = isBusinessAdminRole(
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    if (!isAdmin) {
      const guard = await guardCabinetOwner(
        ctx.tenant.businessId,
        validated.id,
        ctx.session,
        ctx.tenant.effectiveRole,
      );
      if (!guard.ok) {
        return { status: guard.status, error: guard.error };
      }
    }

    const cabinet = await prisma.cabinet.update({
      where: { id: validated.id, ...tenantWhere(ctx.tenant.businessId) },
      data: {
        name: validated.name,
        description: validated.description ?? null,
      },
    });

    return { status: 200, data: cabinet };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du cabinet');
  }
}

async function deleteCabinetUnlogged(businessSlug: string, id: string) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = deleteCabinetSchema.parse({ id });

    await prisma.cabinet.deleteMany({
      where: { id: validated.id, ...tenantWhere(auth.ctx.businessId) },
    });

    return { status: 200 };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du cabinet');
  }
}

export async function getCabinetWithMembers(businessSlug: string, cabinetId: string) {
  try {
    const ctx = await getCabinetSessionContext(businessSlug);
    if (!ctx.ok) return ctx.response;

    const canManage = await canManageCabinetMembers(
      ctx.tenant.businessId,
      cabinetId,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    if (!canManage) {
      const readGuard = await guardCabinetRead(
        ctx.tenant.businessId,
        cabinetId,
        ctx.session,
        ctx.tenant.effectiveRole,
      );
      if (!readGuard.ok) {
        return { status: readGuard.status, error: readGuard.error };
      }
    }

    const cabinet = await prisma.cabinet.findFirst({
      where: { id: cabinetId, ...tenantWhere(ctx.tenant.businessId) },
      include: cabinetIncludeMembers,
    });

    if (!cabinet) {
      return { status: 404, error: 'Cabinet introuvable' };
    }

    return {
      status: 200,
      data: {
        ...cabinet,
        members: await enrichAgendaMembers(ctx.tenant.businessId, cabinet.members),
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement du cabinet');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createCabinet(...args: Parameters<typeof createCabinetUnlogged>) {
  return loggedAction({ feature: 'cabinet', event: 'cabinets.createCabinet' }, args, () =>
    createCabinetUnlogged(...args),
  );
}

export async function updateCabinet(...args: Parameters<typeof updateCabinetUnlogged>) {
  return loggedAction({ feature: 'cabinet', event: 'cabinets.updateCabinet' }, args, () =>
    updateCabinetUnlogged(...args),
  );
}

export async function deleteCabinet(...args: Parameters<typeof deleteCabinetUnlogged>) {
  return loggedAction({ feature: 'cabinet', event: 'cabinets.deleteCabinet' }, args, () =>
    deleteCabinetUnlogged(...args),
  );
}
