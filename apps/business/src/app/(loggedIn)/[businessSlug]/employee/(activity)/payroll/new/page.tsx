import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/authSession';
import { can } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForBusiness, requireBusinessFromSlug } from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import type { AuthSession } from '@/types/session';
import { routes } from '@/types/routes';
import { resolvePayrollDefaultRates } from '@/lib/payroll/salaryTypes';
import PayrollNewPageClient from './PayrollNewPageClient';

export default async function PayrollNewPage({ params }: { params: Promise<{ businessSlug: string }> }) {
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
  if (!can(effectivePermissions, 'payroll_reports', 'create')) {
    redirect(routes.auth.noManagementAccess);
  }

  const rates = await resolvePayrollDefaultRates(business.id);
  return (
    <PayrollNewPageClient
      defaultCaissePriceUsd={rates.caisseUnitUsd}
      defaultPatientCarePriceUsd={rates.patientCareUsd}
    />
  );
}

