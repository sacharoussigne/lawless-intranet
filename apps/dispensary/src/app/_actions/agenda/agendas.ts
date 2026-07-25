'use server';

import { actionErrorParser } from '@/lib/action';
import { requireDispensaryAdminContext } from '@/lib/dispensary/serverActionContext';
import {
  canManageAgendaAsScopeAdmin,
  isDispensaryAdminRole,
} from '@/lib/agenda/access';
import {
  agendaActionError,
  agendaCookie,
  agendaScope,
} from '@/lib/agenda/client';
import type { AgendaSummaryDTO } from '@/types/agenda';
import {
  createAgendaSchema,
  updateAgendaSchema,
  deleteAgendaSchema,
} from '@/app/_actions/agenda/schemas';
import {
  getAgendaSessionContext,
  isScopeAdmin,
  validateDispensaryUserIds,
} from '@/app/_actions/agenda/internals';
import {
  createAgenda as createAgendaApi,
  deleteAgenda as deleteAgendaApi,
  getAgenda,
  getAgendaAccess,
  getAgendaBootstrap,
  listAccessibleAgendas as listAccessibleAgendasApi,
  listAllAgendas,
  updateAgenda as updateAgendaApi,
} from '@lawless-intranet/agenda-client/server';
import { enrichAgendaMembers } from '@/lib/enrichUsers';

export async function listAgendasForAdmin(dispensarySlug: string) {
  try {
    const auth = await requireDispensaryAdminContext(dispensarySlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const agendas = await listAllAgendas(
      agendaScope(auth.ctx.dispensaryId),
      await agendaCookie(),
    );

    const enriched = await Promise.all(
      agendas.map(async (agenda) => ({
        ...agenda,
        members: await enrichAgendaMembers(agenda.members ?? []),
        _count: agenda._count ?? { members: agenda.members?.length ?? 0 },
      })),
    );

    return { status: 200, data: enriched };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors du chargement des agendas');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement des agendas');
    }
  }
}

export async function listAccessibleAgendas(dispensarySlug: string) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const data = (await listAccessibleAgendasApi(
      agendaScope(ctx.tenant.dispensaryId),
      await agendaCookie(),
    )) as AgendaSummaryDTO[];

    return { status: 200, data };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors du chargement des agendas');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement des agendas');
    }
  }
}

export async function getAgendaPageBootstrap(dispensarySlug: string) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const { dispensaryId, effectiveRole } = ctx.tenant;
    const { session } = ctx;

    const bootstrap = await getAgendaBootstrap(
      agendaScope(dispensaryId),
      await agendaCookie(),
    );

    const isAdmin = isDispensaryAdminRole(session.user.role, effectiveRole);

    return {
      status: 200,
      data: {
        hasAccess: bootstrap.hasAccess,
        isAdmin,
        agendas: bootstrap.agendas as AgendaSummaryDTO[],
      },
    };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors du chargement de la page agenda');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement de la page agenda');
    }
  }
}

export async function checkAgendaModuleAccess(dispensarySlug: string) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const access = await getAgendaAccess(
      agendaScope(ctx.tenant.dispensaryId),
      await agendaCookie(),
    );

    const isAdmin = isDispensaryAdminRole(
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    return {
      status: 200,
      data: { hasAccess: access.hasAccess, isAdmin },
    };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la vérification d\'accès');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la vérification d\'accès');
    }
  }
}

export async function createAgenda(
  dispensarySlug: string,
  data: { name: string; description?: string | null; ownerUserId: string },
) {
  try {
    const auth = await requireDispensaryAdminContext(dispensarySlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = createAgendaSchema.parse(data);

    const validOwner = await validateDispensaryUserIds(
      auth.ctx.dispensaryId,
      [validated.ownerUserId],
    );

    if (!validOwner) {
      return {
        status: 400,
        error: 'Le propriétaire doit avoir accès au dispensaire',
      };
    }

    const agenda = await createAgendaApi(
      {
        ...agendaScope(auth.ctx.dispensaryId),
        name: validated.name,
        description: validated.description ?? null,
        ownerUserId: validated.ownerUserId,
      },
      await agendaCookie(),
    );

    return { status: 201, data: agenda };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la création de l\'agenda');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de l\'agenda');
    }
  }
}

export async function updateAgenda(
  dispensarySlug: string,
  data: { id: string; name: string; description?: string | null },
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateAgendaSchema.parse(data);
    const scopeAdmin = isScopeAdmin(ctx.session, ctx.tenant.effectiveRole);

    const agenda = await updateAgendaApi(
      validated.id,
      {
        name: validated.name,
        description: validated.description ?? null,
        scopeAdmin,
      },
      await agendaCookie(),
    );

    return { status: 200, data: agenda };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la mise à jour de l\'agenda');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la mise à jour de l\'agenda');
    }
  }
}

export async function deleteAgenda(dispensarySlug: string, id: string) {
  try {
    const auth = await requireDispensaryAdminContext(dispensarySlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = deleteAgendaSchema.parse({ id });

    await deleteAgendaApi(
      validated.id,
      { scopeAdmin: true },
      await agendaCookie(),
    );

    return { status: 200 };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la suppression de l\'agenda');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de l\'agenda');
    }
  }
}

export async function getAgendaWithMembers(dispensarySlug: string, agendaId: string) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const scopeAdmin = canManageAgendaAsScopeAdmin(
      ctx.session.user.role,
      ctx.tenant.effectiveRole,
    );

    const agenda = await getAgenda(
      agendaId,
      agendaScope(ctx.tenant.dispensaryId),
      { ...(await agendaCookie()), scopeAdmin },
    );

    return {
      status: 200,
      data: {
        ...agenda,
        members: await enrichAgendaMembers(agenda.members ?? []),
      },
    };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors du chargement de l\'agenda');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du chargement de l\'agenda');
    }
  }
}
