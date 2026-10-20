import { notFound, redirect } from 'next/navigation';
import { getPayrollReportById } from '@/app/_actions/payrollReports';
import { getAuthSession } from '@/lib/authSession';
import { can } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForBusiness, requireBusinessFromSlug } from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import type { AuthSession } from '@/types/session';
import { routes } from '@/types/routes';
import PayrollReportDetailPageClient from './PayrollReportDetailPageClient';

type PageProps = { params: Promise<{ businessSlug: string; id: string }> };

export default async function PayrollReportByIdPage({ params }: PageProps) {
  const { businessSlug, id } = await params;
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

  const canDelete = can(effectivePermissions, 'payroll_reports', 'create');

  const result = await getPayrollReportById(businessSlug, id);
  if (result.status === 404) {
    notFound();
  }
  if (result.status !== 200 || !('data' in result)) {
    throw new Error('Erreur lors du chargement du rapport');
  }

  return (
    <PayrollReportDetailPageClient
      reportId={id}
      initialReport={result.data.report}
      canDelete={canDelete}
      canEdit={canDelete}
    />
  );
}
