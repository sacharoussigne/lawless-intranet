'use server';

import { realtimeTopics } from '@lawless-intranet/realtime';
import { signRealtimeToken } from '@lawless-intranet/realtime/token';
import { getAgendaAccess } from '@lawless-intranet/agenda-client/server';
import { actionErrorParser } from '@/lib/action';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import { agendaCookie, agendaScope, AGENDA_SCOPE_TYPE } from '@/lib/agenda/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

/**
 * Signs a short-lived token listing the realtime topics the current user may
 * receive in this dispensary. The websocket server trusts it as-is, so every
 * topic must be checked here.
 */
export async function getRealtimeToken(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const secret = process.env.REALTIME_TOKEN_SECRET;
    if (!secret) {
      return { status: 503, error: 'Temps réel non configuré' };
    }

    const userId = ctx.session.user.id;
    const { dispensaryId } = ctx.tenant;
    const topics = [realtimeTopics.user(userId)];

    const agendaBlocked = await getAppFeatureActionBlock(dispensaryId, 'agenda');
    if (!agendaBlocked) {
      const access = await getAgendaAccess(agendaScope(dispensaryId), await agendaCookie());
      topics.push(realtimeTopics.agendas(AGENDA_SCOPE_TYPE, dispensaryId));
      for (const agendaId of access.accessibleAgendaIds) {
        topics.push(realtimeTopics.agenda(agendaId));
      }
    }

    return { status: 200, data: signRealtimeToken({ userId, topics }, secret) };
  } catch (error) {
    return actionErrorParser(error, 'Impossible de se connecter au temps réel');
  }
}
