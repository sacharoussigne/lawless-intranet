import { Container, Group, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';
import { listPayrollReports } from '@/app/_actions/payrollReports';
import { getAuthSession } from '@/lib/authSession';
import { can } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForBusiness, requireBusinessFromSlug } from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import { getDataOrThrow } from '@/lib/response';
import type { AuthSession } from '@/types/session';
import { routes } from '@/types/routes';
import PayrollNewReportButton from './PayrollNewReportButton';
import PayrollReportsPageClient from './PayrollReportsPageClient';

export default async function PayrollReportsPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const business = await requireBusinessFromSlug(businessSlug);
  const session = await getAuthSession();
  if (!session?.user) {
    redirect(routes.auth.login);
  }

  const effectiveRole = await getEffectiveRoleForBusiness(session as AuthSession, business.id);
  const effectivePermissions = await resolveEffectivePermissionsForBusiness(
    session as AuthSession,
    business.id,
    effectiveRole,
  );
  if (!can(effectivePermissions, 'payroll_reports', 'view')) {
    redirect(routes.auth.noManagementAccess);
  }

  const canCreate = can(effectivePermissions, 'payroll_reports', 'create');

  const result = await listPayrollReports(businessSlug);
  const { reports } = getDataOrThrow(result, 'Erreur lors du chargement des rapports salaires');

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl" align="flex-start">
        <div>
          <Title order={1}>Rapports salaires hebdomadaires</Title>
          <Text c="dimmed" mt="xs">
            Historique des analyses de présences et caisses, avec montants pour virements.
          </Text>
        </div>
        {canCreate && <PayrollNewReportButton />}
      </Group>
      <PayrollReportsPageClient initialReports={reports} canDelete={canCreate} />
    </Container>
  );
}
