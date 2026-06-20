import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/authSession';
import { checkRolePermission } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForDispensary, requireDispensaryFromSlug } from '@/lib/dispensary/context';
import type { AuthSession } from '@/types/session';
import { getAppSettings } from '@/lib/appSettings';
import { routes, tenantRoutes } from '@/types/routes';
import { getStockMovementsPage } from '@/app/_actions/stock';
import { getMondayOfCurrentWeek, getTodayStart } from '@/lib/date';
import StockMovementsPageClient from './StockMovementsPageClient';

export default async function StockMovementsPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  const dispensary = await requireDispensaryFromSlug(dispensarySlug);
  const session = await getAuthSession();
  if (!session?.user) {
    redirect(routes.auth.login);
  }

  const appSettings = await getAppSettings(dispensary.id);
  if (!appSettings.featureStockEnabled) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const effectiveRole = await getEffectiveRoleForDispensary(session as AuthSession, dispensary.id);
  if (!checkRolePermission(effectiveRole, 'stock_statistics', 'view')) {
    redirect(routes.auth.noManagementAccess);
  }

  const initialPageResult = await getStockMovementsPage(dispensarySlug, {
    page: 1,
    pageSize: 25,
    from: getMondayOfCurrentWeek(),
    to: getTodayStart(),
  });

  const initialPage =
    initialPageResult.status === 200 && 'data' in initialPageResult
      ? initialPageResult.data
      : undefined;

  return <StockMovementsPageClient initialPage={initialPage} />;
}
