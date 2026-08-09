import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/authSession';
import { can } from '@lawless-intranet/auth-permissions';
import { getEffectiveRoleForDispensary, requireDispensaryFromSlug } from '@/lib/dispensary/context';
import { resolveEffectivePermissionsForDispensary } from '@/lib/dispensary/permissionsResolve';
import type { AuthSession } from '@/types/session';
import { routes } from '@/types/routes';
import PayrollNewPageClient from './PayrollNewPageClient';

export default async function PayrollNewPage({ params }: { params: Promise<{ dispensarySlug: string }> }) {
  const { dispensarySlug } = await params;
  const dispensary = await requireDispensaryFromSlug(dispensarySlug);
  const session = await getAuthSession();
  if (!session?.user) {
    redirect(routes.auth.login);
  }

  const effectiveRole = await getEffectiveRoleForDispensary(session as AuthSession, dispensary.id);
  const effectivePermissions = await resolveEffectivePermissionsForDispensary(
    session as AuthSession,
    dispensary.id,
    effectiveRole,
  );
  if (!can(effectivePermissions, 'payroll_reports', 'create')) {
    redirect(routes.auth.noManagementAccess);
  }

  return <PayrollNewPageClient />;
}

