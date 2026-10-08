'use server';

import { realtimeTopics } from '@lawless-intranet/realtime';
import { signRealtimeToken } from '@lawless-intranet/realtime/token';
import { actionErrorParser } from '@/lib/action';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import { MEDIA_SCOPE_TYPE } from '@/lib/media/client';
import { getRealtimeTokenSecret } from '@/lib/realtime/socketConfig';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { can } from '@/lib/shelter/permissionsCatalog';

/**
 * Signs a short-lived token listing the realtime topics the current user may
 * receive in this shelter. The websocket server trusts it as-is, so every
 * topic must be checked here.
 */
export async function getRealtimeToken(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug);
    if (!ctx.ok) return ctx.response;

    const secret = getRealtimeTokenSecret();
    if (!secret) {
      return { status: 503, error: 'Temps réel non configuré' };
    }

    const userId = ctx.session.user.id;
    const { shelterId, effectivePermissions } = ctx.tenant;
    const topics = [realtimeTopics.user(userId)];

    const mediaBlocked = await getAppFeatureActionBlock(shelterId, 'media');
    if (!mediaBlocked && can(effectivePermissions, 'media', 'access')) {
      topics.push(realtimeTopics.media(MEDIA_SCOPE_TYPE, shelterId));
    }

    return { status: 200, data: signRealtimeToken({ userId, topics }, secret) };
  } catch (error) {
    return actionErrorParser(error, 'Impossible de se connecter au temps réel');
  }
}
