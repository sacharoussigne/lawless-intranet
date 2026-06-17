'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireDispensaryAdminContext } from '@/lib/dispensary/serverActionContext';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import {
  isDispensaryAdminRole,
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
  validateDispensaryUserIds,
} from '@/app/_actions/cabinet/internals';
import { enrichCabinetMembers } from '@/lib/cabinet/enrichMembers';
import { createDefaultFormSchemas } from '@/lib/cabinet/formSchema';

const cabinetIncludeMembers = {
  members: {
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { members: true, patients: true } },
};

export async function listCabinetsForAdmin(dispensarySlug: string) {
  try {
    const auth = await requireDispensaryAdminContext(dispensarySlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const cabinets = await prisma.cabinet.findMany({
      where: tenantWhere(auth.ctx.dispensaryId),
      include: cabinetIncludeMembers,
      orderBy: { name: 'asc' },
    });

    const enriched = await Promise.all(
      cabinets.map(async (cabinet) => ({
        ...cabinet,
        members: await enrichCabinetMembers(cabinet.members),
      })),
    );

    return { status: 200, data: enriched };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des cabinets');
  }
}

export async function listAccessibleCabinets(dispensarySlug: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const { dispensaryId } = ctx.tenant;
    const { session } = ctx;

    const cabinetIds = await listAccessibleCabinetIds(dispensaryId, session.user.id);

    if (cabinetIds.length === 0) {
      return { status: 200, data: [] as CabinetSummaryDTO[] };
    }

    const cabinets = await prisma.cabinet.findMany({
      where: { id: { in: cabinetIds }, ...tenantWhere(dispensaryId) },
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

    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des cabinets');
  }
}

export async function getCabinetPageBootstrap(dispensarySlug: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const { dispensaryId, effectiveRole } = ctx.tenant;
    const { session } = ctx;

    const hasAccess = await userHasAnyCabinetAccess(dispensaryId, session.user.id);
    const isAdmin = isDispensaryAdminRole(session.user.role, effectiveRole);

    if (!hasAccess) {
      return {
        status: 200,
        data: { hasAccess: false, isAdmin, cabinets: [] as CabinetSummaryDTO[] },
      };
    }

    const cabinetIds = await listAccessibleCabinetIds(dispensaryId, session.user.id);

    if (cabinetIds.length === 0) {
      return {
        status: 200,
        data: { hasAccess: true, isAdmin, cabinets: [] as CabinetSummaryDTO[] },
      };
    }

    const cabinets = await prisma.cabinet.findMany({
      where: { id: { in: cabinetIds }, ...tenantWhere(dispensaryId) },
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

export async function createCabinet(
  dispensarySlug: string,
  data: { name: string; description?: string | null; ownerUserId: string },
) {
  try {
    const auth = await requireDispensaryAdminContext(dispensarySlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = createCabinetSchema.parse(data);

    const validOwner = await validateDispensaryUserIds(auth.ctx.dispensaryId, [
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
          dispensaryId: auth.ctx.dispensaryId,
          name: validated.name,
          description: validated.description ?? null,
          formSchemas: defaultSchemas as object,
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

export async function updateCabinet(
  dispensarySlug: string,
  data: { id: string; name: string; description?: string | null },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateCabinetSchema.parse(data);
    const isAdmin = isDispensaryAdminRole(
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    if (!isAdmin) {
      const guard = await guardCabinetOwner(
        ctx.tenant.dispensaryId,
        validated.id,
        ctx.session,
        ctx.tenant.effectiveRole,
      );
      if (!guard.ok) {
        return { status: guard.status, error: guard.error };
      }
    }

    const cabinet = await prisma.cabinet.update({
      where: { id: validated.id, ...tenantWhere(ctx.tenant.dispensaryId) },
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

export async function deleteCabinet(dispensarySlug: string, id: string) {
  try {
    const auth = await requireDispensaryAdminContext(dispensarySlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = deleteCabinetSchema.parse({ id });

    await prisma.cabinet.deleteMany({
      where: { id: validated.id, ...tenantWhere(auth.ctx.dispensaryId) },
    });

    return { status: 200 };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du cabinet');
  }
}

export async function getCabinetWithMembers(dispensarySlug: string, cabinetId: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const canManage = await canManageCabinetMembers(
      ctx.tenant.dispensaryId,
      cabinetId,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    if (!canManage) {
      const readGuard = await guardCabinetRead(
        ctx.tenant.dispensaryId,
        cabinetId,
        ctx.session,
        ctx.tenant.effectiveRole,
      );
      if (!readGuard.ok) {
        return { status: readGuard.status, error: readGuard.error };
      }
    }

    const cabinet = await prisma.cabinet.findFirst({
      where: { id: cabinetId, ...tenantWhere(ctx.tenant.dispensaryId) },
      include: cabinetIncludeMembers,
    });

    if (!cabinet) {
      return { status: 404, error: 'Cabinet introuvable' };
    }

    return {
      status: 200,
      data: {
        ...cabinet,
        members: await enrichCabinetMembers(cabinet.members),
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement du cabinet');
  }
}

export async function getCabinetFormSchemas(dispensarySlug: string, cabinetId: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const guard = await guardCabinetRead(
      ctx.tenant.dispensaryId,
      cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const cabinet = await prisma.cabinet.findFirst({
      where: { id: cabinetId, ...tenantWhere(ctx.tenant.dispensaryId) },
      select: { formSchemas: true },
    });

    if (!cabinet) {
      return { status: 404, error: 'Cabinet introuvable' };
    }

    return { status: 200, data: cabinet.formSchemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement du schéma');
  }
}
