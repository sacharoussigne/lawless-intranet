import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/authSession';
import { can } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForBusiness, requireBusinessFromSlug } from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import type { AuthSession } from '@/types/session';
import { getAppSettings } from '@/lib/appSettings';
import { routes, tenantRoutes } from '@/types/routes';
import { getStockMovementsPage } from '@/app/_actions/stock';
import { getMondayOfCurrentWeek, getTodayStart } from '@/lib/date';
import StockMovementsPageClient from './StockMovementsPageClient';

export default async function StockMovementsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const business = await requireBusinessFromSlug(businessSlug);
  const session = await getAuthSession();
  if (!session?.user) {
    redirect(routes.auth.login);
  }

  const appSettings = await getAppSettings(business.id);
  if (!appSettings.featureStockEnabled) {
    redirect(tenantRoutes(businessSlug).employee.index);
  }

  const effectiveRole = await getEffectiveRoleForBusiness(session as AuthSession, business.id);
  const effectivePermissions = await resolveEffectivePermissionsForBusiness(
    session as AuthSession,
    business.id,
    effectiveRole,
  );
  if (!can(effectivePermissions, 'stock_statistics', 'view')) {
    redirect(routes.auth.noManagementAccess);
  }

  const initialPageResult = await getStockMovementsPage(businessSlug, {
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
