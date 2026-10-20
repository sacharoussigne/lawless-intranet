import { Container } from '@mantine/core';
import { redirect } from 'next/navigation';
import { listWeeklySales } from '@/app/_actions/sales';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { getAuthSession } from '@/lib/authSession';
import { hasRole, can } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForBusiness, requireBusinessFromSlug } from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import { getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import { getDataOrThrow } from '@/lib/response';
import type { AuthSession } from '@/types/session';
import { routes, tenantRoutes } from '@/types/routes';
import { Role } from '@/types/enum/roles';
import SalesPageClient from './SalesPageClient';

export default async function SalesPage({
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
  if (!isAppFeatureEnabled(appSettings, 'sales')) {
    redirect(tenantRoutes(businessSlug).employee.index);
  }

  const effectiveRole = await getEffectiveRoleForBusiness(session as AuthSession, business.id);
  const effectivePermissions = await resolveEffectivePermissionsForBusiness(
    session as AuthSession,
    business.id,
    effectiveRole,
  );
  if (!can(effectivePermissions, 'sales', 'view_all')) {
    redirect(routes.auth.noManagementAccess);
  }

  const canCancel = can(effectivePermissions, 'sales', 'cancel');
  const canDepositOthers =
    hasRole(effectiveRole, Role.ADMIN) || hasRole(effectiveRole, Role.DIRECTION);
  const canDelete = hasRole(effectiveRole, Role.ADMIN);
  const salesResult = await listWeeklySales(businessSlug);
  const initialSummary = getDataOrThrow(salesResult, 'Erreur lors du chargement des ventes');

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Ventes"
        description="Suivi hebdomadaire des ventes de tous les employés."
        backHref={tenantRoutes(businessSlug).employee.index}
      />
      <SalesPageClient
        businessSlug={businessSlug}
        canCancel={canCancel}
        canDepositOthers={canDepositOthers}
        canDelete={canDelete}
        sessionUserId={session.user.id}
        initialSummary={initialSummary}
      />
    </Container>
  );
}
