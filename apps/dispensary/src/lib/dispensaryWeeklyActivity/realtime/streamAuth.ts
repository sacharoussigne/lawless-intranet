import { getRequestAuthSession } from '@/lib/authSession';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import { requireDispensaryAccess } from '@/lib/dispensary/context';
import {
  canEditAllWeeklyDispensaryActivity,
  canViewWeeklyDispensaryActivity,
} from '@/lib/dispensaryWeeklyActivity/access';
import { getDiscordAccountIdForUser } from '@/lib/dispensaryWeeklyActivity/resolveDisplayName';
import type { WeeklyActivityRealtimeViewerFilter } from '@/lib/dispensaryWeeklyActivity/realtime/types';
import prisma from '@/lib/prisma';

export async function requireWeeklyActivityStreamAccess(
  request: Request,
  dispensarySlug: string,
): Promise<
  | {
      ok: true;
      dispensaryId: string;
      userId: string;
      filter: WeeklyActivityRealtimeViewerFilter;
    }
  | { ok: false; status: number; error: string }
> {
  const session = await getRequestAuthSession(request);
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Non autorisé' };
  }

  try {
    const { dispensary, effectiveRole } = await requireDispensaryAccess(
      session,
      dispensarySlug,
    );

    const featureBlock = await getAppFeatureActionBlock(
      dispensary.id,
      'weeklyDispensaryActivity',
    );
    if (featureBlock) {
      return { ok: false, status: featureBlock.status, error: featureBlock.error };
    }

    if (!canViewWeeklyDispensaryActivity(effectiveRole)) {
      return { ok: false, status: 403, error: 'Accès activité hebdomadaire refusé' };
    }

    const viewerDiscordUserId = await getDiscordAccountIdForUser(prisma, session.user.id);

    return {
      ok: true,
      dispensaryId: dispensary.id,
      userId: session.user.id,
      filter: {
        canEditAll: canEditAllWeeklyDispensaryActivity(effectiveRole),
        viewerUserId: session.user.id,
        viewerDiscordUserId,
      },
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
