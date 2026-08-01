import { Container } from '@mantine/core';
import { redirect } from 'next/navigation';
import { listWeeklySales } from '@/app/_actions/sales';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { getAuthSession } from '@/lib/authSession';
import { checkRolePermission, hasRole } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForDispensary, requireDispensaryFromSlug } from '@/lib/dispensary/context';
import { getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import { getDataOrThrow } from '@/lib/response';
import type { AuthSession } from '@/types/session';
import { routes, tenantRoutes } from '@/types/routes';
import { Role } from '@/types/enum/roles';
import SalesPageClient from './SalesPageClient';

export default async function SalesPage({
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
  if (!isAppFeatureEnabled(appSettings, 'sales')) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const effectiveRole = await getEffectiveRoleForDispensary(session as AuthSession, dispensary.id);
  if (!checkRolePermission(effectiveRole, 'sales', 'view_all')) {
    redirect(routes.auth.noManagementAccess);
  }

  const canCancel = checkRolePermission(effectiveRole, 'sales', 'cancel');
  const canDepositOthers =
    hasRole(effectiveRole, Role.ADMIN) || hasRole(effectiveRole, Role.DIRECTION);
  const salesResult = await listWeeklySales(dispensarySlug);
  const initialSummary = getDataOrThrow(salesResult, 'Erreur lors du chargement des ventes');

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Ventes"
        description="Suivi hebdomadaire des ventes de tous les employés."
        backHref={tenantRoutes(dispensarySlug).employee.index}
      />
      <SalesPageClient
        dispensarySlug={dispensarySlug}
        canCancel={canCancel}
        canDepositOthers={canDepositOthers}
        sessionUserId={session.user.id}
        initialSummary={initialSummary}
      />
    </Container>
  );
}
