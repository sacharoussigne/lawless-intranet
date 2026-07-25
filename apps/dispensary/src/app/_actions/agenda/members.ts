'use server';

import { actionErrorParser } from '@/lib/action';
import { requireDispensaryAdminContext } from '@/lib/dispensary/serverActionContext';
import {
  upsertAgendaMemberSchema,
  removeAgendaMemberSchema,
} from '@/app/_actions/agenda/schemas';
import {
  getAgendaSessionContext,
  isScopeAdmin,
  searchEligibleDispensaryUsersForAgenda,
  validateDispensaryUserIds,
} from '@/app/_actions/agenda/internals';
import {
  agendaActionError,
  agendaCookie,
} from '@/lib/agenda/client';
import {
  removeAgendaMember as removeAgendaMemberApi,
  upsertAgendaMember as upsertAgendaMemberApi,
} from '@lawless-intranet/agenda-client/server';
import { enrichAgendaMembers } from '@/lib/enrichUsers';

export async function upsertAgendaMember(
  dispensarySlug: string,
  data: { agendaId: string; userId: string; accessLevel: 'OWNER' | 'WRITE' | 'READ' },
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = upsertAgendaMemberSchema.parse(data);
    const scopeAdmin = isScopeAdmin(ctx.session, ctx.tenant.effectiveRole);

    const validUser = await validateDispensaryUserIds(
      ctx.tenant.dispensaryId,
      [validated.userId],
    );
    if (!validUser) {
      return { status: 400, error: 'Utilisateur non membre du dispensaire' };
    }

    const member = await upsertAgendaMemberApi(
      validated.agendaId,
      {
        userId: validated.userId,
        accessLevel: validated.accessLevel,
        scopeAdmin,
      },
      await agendaCookie(),
    );

    const [enriched] = await enrichAgendaMembers([member]);

    return { status: 200, data: enriched };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la mise à jour du membre');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la mise à jour du membre');
    }
  }
}

export async function removeAgendaMember(
  dispensarySlug: string,
  data: { agendaId: string; userId: string },
) {
  try {
    const ctx = await getAgendaSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = removeAgendaMemberSchema.parse(data);
    const scopeAdmin = isScopeAdmin(ctx.session, ctx.tenant.effectiveRole);

    await removeAgendaMemberApi(
      validated.agendaId,
      validated.userId,
      { scopeAdmin },
      await agendaCookie(),
    );

    return { status: 200 };
  } catch (error) {
    try {
      return agendaActionError(error, 'Erreur lors de la suppression du membre');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression du membre');
    }
  }
}

export type AgendaUserSearchResult = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function searchDispensaryUsersForAgenda(
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
      const ctx = await getAgendaSessionContext(dispensarySlug);
      if (!ctx.ok) return ctx.response;
      dispensaryId = ctx.tenant.dispensaryId;
    }

    const data = await searchEligibleDispensaryUsersForAgenda(dispensaryId, query);

    return {
      status: 200,
      data,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la recherche');
  }
}
