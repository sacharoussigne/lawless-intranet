'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { actionErrorParser } from '@/lib/action';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';
import {
  upsertAgendaMemberSchema,
  removeAgendaMemberSchema,
} from '@/app/_actions/agenda/schemas';
import {
  getAgendaSessionContext,
  isScopeAdmin,
  searchEligibleBusinessUsersForAgenda,
  validateBusinessUserIds,
} from '@/app/_actions/agenda/internals';
import {
  agendaCookie,
} from '@/lib/agenda/client';
import {
  removeAgendaMember as removeAgendaMemberApi,
  upsertAgendaMember as upsertAgendaMemberApi,
} from '@lawless-intranet/agenda-client/server';
import { enrichAgendaMembers } from '@/lib/enrichUsers';

async function upsertAgendaMemberUnlogged(
  businessSlug: string,
  data: { agendaId: string; userId: string; accessLevel: 'OWNER' | 'WRITE' | 'READ' },
) {
  try {
    const ctx = await getAgendaSessionContext(businessSlug);
    if (!ctx.ok) return ctx.response;

    const validated = upsertAgendaMemberSchema.parse(data);
    const scopeAdmin = isScopeAdmin(ctx.session, ctx.tenant.effectiveRole);

    const validUser = await validateBusinessUserIds(
      ctx.tenant.businessId,
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

    const [enriched] = await enrichAgendaMembers(ctx.tenant.businessId, [member]);

    return { status: 200, data: enriched };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la mise à jour du membre');
  }
}

async function removeAgendaMemberUnlogged(
  businessSlug: string,
  data: { agendaId: string; userId: string },
) {
  try {
    const ctx = await getAgendaSessionContext(businessSlug);
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
    return serviceActionError(error, 'Erreur lors de la suppression du membre');
  }
}

export type AgendaUserSearchResult = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function searchBusinessUsersForAgenda(
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
      const ctx = await getAgendaSessionContext(businessSlug);
      if (!ctx.ok) return ctx.response;
      businessId = ctx.tenant.businessId;
    }

    const data = await searchEligibleBusinessUsersForAgenda(businessId, query);

    return {
      status: 200,
      data,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la recherche');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function upsertAgendaMember(...args: Parameters<typeof upsertAgendaMemberUnlogged>) {
  return loggedAction(
    {
      feature: 'agenda',
      event: 'members.upsertAgendaMember',
      target: ([, data]) => data.agendaId,
    },
    args,
    () => upsertAgendaMemberUnlogged(...args),
  );
}

export async function removeAgendaMember(...args: Parameters<typeof removeAgendaMemberUnlogged>) {
  return loggedAction(
    {
      feature: 'agenda',
      event: 'members.removeAgendaMember',
      target: ([, data]) => data.agendaId,
    },
    args,
    () => removeAgendaMemberUnlogged(...args),
  );
}
