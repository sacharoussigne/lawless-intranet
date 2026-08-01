import { checkRolePermission } from '@lawless-intranet/auth-permissions';
import { getRequestAuthSession } from '@/lib/authSession';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import { requireDispensaryAccess } from '@/lib/dispensary/context';
import type { WeeklySalesRealtimeViewerFilter } from '@/lib/sales/realtime/types';

export async function requireWeeklySalesStreamAccess(
  request: Request,
  dispensarySlug: string,
): Promise<
  | {
      ok: true;
      dispensaryId: string;
      userId: string;
      filter: WeeklySalesRealtimeViewerFilter;
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

    const featureBlock = await getAppFeatureActionBlock(dispensary.id, 'sales');
    if (featureBlock) {
      return { ok: false, status: featureBlock.status, error: featureBlock.error };
    }

    if (!checkRolePermission(effectiveRole, 'sales', 'view')) {
      return { ok: false, status: 403, error: 'Accès ventes refusé' };
    }

    return {
      ok: true,
      dispensaryId: dispensary.id,
      userId: session.user.id,
      filter: {
        canViewAll: checkRolePermission(effectiveRole, 'sales', 'view_all'),
        viewerUserId: session.user.id,
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
