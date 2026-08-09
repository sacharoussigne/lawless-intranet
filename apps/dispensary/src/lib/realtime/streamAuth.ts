import { can } from '@lawless-intranet/auth-permissions';
import { getRequestAuthSession } from '@/lib/authSession';
import { userHasAnyAgendaAccess } from '@/lib/agenda/access';
import { getAppFeatureActionBlock, getAppSettings } from '@/lib/appSettings';
import {
  canEditAllWeeklyDispensaryActivity,
  canViewWeeklyDispensaryActivity,
} from '@/lib/dispensaryWeeklyActivity/access';
import { getDiscordAccountIdForUser } from '@/lib/dispensaryWeeklyActivity/resolveDisplayName';
import { requireDispensaryAccess } from '@/lib/dispensary/context';
import type { DispensaryRealtimeViewerFilter } from '@/lib/realtime/types';
import prisma from '@/lib/prisma';

export async function requireDispensaryRealtimeStreamAccess(
  request: Request,
  dispensarySlug: string,
): Promise<
  | {
      ok: true;
      dispensaryId: string;
      userId: string;
      filter: DispensaryRealtimeViewerFilter;
    }
  | { ok: false; status: number; error: string }
> {
  const session = await getRequestAuthSession(request);
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Non autorisé' };
  }

  try {
    const { dispensary, effectiveRole, effectivePermissions } = await requireDispensaryAccess(
      session,
      dispensarySlug,
    );
    const settings = await getAppSettings(dispensary.id);

    let agenda = false;
    if (settings.featureAgendaEnabled) {
      const featureBlock = await getAppFeatureActionBlock(dispensary.id, 'agenda');
      if (!featureBlock) {
        agenda = await userHasAnyAgendaAccess(
          dispensary.id,
          session.user.id,
          session.user.role,
          effectiveRole,
        );
      }
    }

    let weeklyActivity: DispensaryRealtimeViewerFilter['weeklyActivity'] = null;
    if (settings.featureWeeklyDispensaryActivityEnabled) {
      const featureBlock = await getAppFeatureActionBlock(
        dispensary.id,
        'weeklyDispensaryActivity',
      );
      if (!featureBlock && canViewWeeklyDispensaryActivity(effectivePermissions)) {
        weeklyActivity = {
          canEditAll: canEditAllWeeklyDispensaryActivity(effectivePermissions),
          viewerUserId: session.user.id,
          viewerDiscordUserId: await getDiscordAccountIdForUser(
            prisma,
            session.user.id,
          ),
        };
      }
    }

    let sales: DispensaryRealtimeViewerFilter['sales'] = null;
    if (settings.featureSalesEnabled) {
      const featureBlock = await getAppFeatureActionBlock(dispensary.id, 'sales');
      if (!featureBlock && can(effectivePermissions, 'sales', 'view')) {
        sales = {
          canViewAll: can(effectivePermissions, 'sales', 'view_all'),
          viewerUserId: session.user.id,
        };
      }
    }

    let orders = false;
    if (settings.featureOrdersEnabled) {
      const featureBlock = await getAppFeatureActionBlock(dispensary.id, 'orders');
      if (!featureBlock && can(effectivePermissions, 'orders', 'view')) {
        orders = true;
      }
    }

    if (!agenda && !weeklyActivity && !sales && !orders) {
      return { ok: false, status: 403, error: 'Aucun flux temps réel autorisé' };
    }

    return {
      ok: true,
      dispensaryId: dispensary.id,
      userId: session.user.id,
      filter: { agenda, weeklyActivity, sales, orders },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'DISPENSARY_NOT_FOUND') {
      return { ok: false, status: 404, error: 'Dispensaire introuvable' };
    }
    if (message === 'DISPENSARY_ACCESS_DENIED') {
      return { ok: false, status: 403, error: 'Accès refusé à ce dispensaire' };
    }
    throw error;
  }
}
