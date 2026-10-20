import { Container, Title } from '@mantine/core';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/authSession';
import { can } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForBusiness, requireBusinessFromSlug } from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import type { AuthSession } from '@/types/session';
import { getAppSettings } from '@/lib/appSettings';
import { routes, tenantRoutes } from '@/types/routes';
import StockStatisticsPageClient from './StockStatisticsPageClient';

export default async function StockStatisticsPage({ params }: { params: Promise<{ businessSlug: string }> }) {
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

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="xl">
        Statistiques de stock
      </Title>
      <StockStatisticsPageClient />
    </Container>
  );
}
