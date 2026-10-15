import { realtimeTopics } from '@lawless-intranet/realtime';
import { signRealtimeToken } from '@lawless-intranet/realtime/token';
import { getAgendaAccess } from '@lawless-intranet/agenda-client/server';
import { can } from '@lawless-intranet/auth-permissions';
import { actionErrorParser } from '@/lib/action';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import { agendaCookie, agendaScope, AGENDA_SCOPE_TYPE } from '@/lib/agenda/client';
import { MEDIA_SCOPE_TYPE } from '@/lib/media/client';
import {
  canEditAllWeeklyDispensaryActivity,
  canViewWeeklyDispensaryActivity,
} from '@/lib/dispensaryWeeklyActivity/access';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { getRealtimeTokenSecret } from '@/lib/realtime/socketConfig';

/**
 * Signs a short-lived token listing the realtime topics the current user may
 * receive in this dispensary. The websocket server trusts it as-is, so every
 * topic must be checked here.
 * Served by GET `/api/d/<slug>/realtime-token`.
 */
export async function createRealtimeToken(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const secret = getRealtimeTokenSecret();
    if (!secret) {
      return { status: 503, error: 'Temps réel non configuré' };
    }

    const userId = ctx.session.user.id;
    const { dispensaryId, effectivePermissions } = ctx.tenant;
    const topics = [realtimeTopics.user(userId)];

    const agendaBlocked = await getAppFeatureActionBlock(dispensaryId, 'agenda');
    if (!agendaBlocked) {
      const access = await getAgendaAccess(agendaScope(dispensaryId), await agendaCookie());
      topics.push(realtimeTopics.agendas(AGENDA_SCOPE_TYPE, dispensaryId));
      for (const agendaId of access.accessibleAgendaIds) {
        topics.push(realtimeTopics.agenda(agendaId));
      }
    }

    const ordersBlocked = await getAppFeatureActionBlock(dispensaryId, 'orders');
    if (!ordersBlocked && can(effectivePermissions, 'orders', 'view')) {
      topics.push(realtimeTopics.orders(dispensaryId));
    }

    const salesBlocked = await getAppFeatureActionBlock(dispensaryId, 'sales');
    if (!salesBlocked && can(effectivePermissions, 'sales', 'view')) {
      topics.push(
        can(effectivePermissions, 'sales', 'view_all')
          ? realtimeTopics.sales(dispensaryId)
          : realtimeTopics.salesOfUser(dispensaryId, userId),
      );
    }

    const weeklyActivityBlocked = await getAppFeatureActionBlock(
      dispensaryId,
      'weeklyDispensaryActivity',
    );
    if (!weeklyActivityBlocked && canViewWeeklyDispensaryActivity(effectivePermissions)) {
      topics.push(
        canEditAllWeeklyDispensaryActivity(effectivePermissions)
          ? realtimeTopics.weeklyActivity(dispensaryId)
          : realtimeTopics.weeklyActivityOfUser(dispensaryId, userId),
      );
    }

    const mediaBlocked = await getAppFeatureActionBlock(dispensaryId, 'media');
    if (!mediaBlocked && can(effectivePermissions, 'media', 'access')) {
      topics.push(realtimeTopics.media(MEDIA_SCOPE_TYPE, dispensaryId));
    }

    return { status: 200, data: signRealtimeToken({ userId, topics }, secret) };
  } catch (error) {
    return actionErrorParser(error, 'Impossible de se connecter au temps réel');
  }
}
