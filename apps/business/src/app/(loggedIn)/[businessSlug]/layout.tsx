import Header from '@/app/(loggedIn)/_components/Header/Header';
import { getBusinessUserName } from '@/lib/people/userProfiles';
import { MobileTabBar } from '@/app/(loggedIn)/_components/MobileTabBar/MobileTabBar';
import { LoggedInShell } from '@/app/(loggedIn)/_components/LoggedInShell/LoggedInShell';
import { getAuthSession } from '@/lib/authSession';
import { PermissionsProvider } from '@/app/_contexts/PermissionsContext';
import { calculatePermissionsFromEffective } from '@/lib/auth/calculatePermissions';
import { getAppSettings } from '@/lib/appSettings';
import type { AuthSession } from '@/types/session';
import { getImpersonatorDisplayName } from '@/lib/auth/impersonationDisplay';
import { listAccessibleBusinessesForRequest } from '@/lib/business/accessibleBusinesses';
import {
  requireBusinessFromSlug,
  getEffectiveRoleForBusiness,
  userCanAccessBusiness,
  resolveBusinessAccessDeniedRedirect,
} from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import { notFound, redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { userHasAnyAgendaAccess, listAccessibleAgendaIds } from '@/lib/agenda/access';
import { userHasAnyCabinetAccess, listAccessibleCabinetIds } from '@/lib/cabinet/access';
import { userHasAccessibleChests } from '@/lib/chests/access';
import { BusinessRealtimeSocketShell } from './BusinessRealtimeSocketShell';
import { getRealtimePublicUrl } from '@/lib/realtime/socketConfig';
import { OrdersRealtimeBridge } from './OrdersRealtimeBridge';
import { StockRealtimeBridge } from './StockRealtimeBridge';
import { QueryProvider } from '@/lib/react-query/QueryProvider';
import { getMemberDescription } from '@/lib/business/memberDescription';
import { MailTemplateProvider } from '@lawless-intranet/mail-template-ui';

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const session = await getAuthSession();
  const business = await requireBusinessFromSlug(businessSlug).catch(() => null);

  if (!business) {
    notFound();
  }

  const authSession = session as AuthSession | null;
  const canAccess = await userCanAccessBusiness(authSession, business.id);
  if (!canAccess && session) {
    const target = await resolveBusinessAccessDeniedRedirect(
      session,
      tenantRoutes(businessSlug).employee.index,
    );
    redirect(target);
  }

  const [
    impersonatorDisplayName,
    effectiveRole,
    appSettings,
    accessibleBusinesses,
  ] = await Promise.all([
    getImpersonatorDisplayName(session?.session?.impersonatedBy),
    getEffectiveRoleForBusiness(authSession, business.id),
    getAppSettings(business.id),
    listAccessibleBusinessesForRequest(authSession),
  ]);

  const user = session?.user;
  const userId = user?.id;
  // Independent reads: run together instead of one after the other.
  const [
    effectivePermissions,
    username,
    [agendaModuleAccess, accessibleAgendaIds],
    [cabinetModuleAccess, accessibleCabinetIds],
    hasAccessibleChests,
    memberDescription,
  ] = await Promise.all([
    resolveEffectivePermissionsForBusiness(authSession, business.id, effectiveRole),
    getBusinessUserName(business.id, userId, user?.name ?? 'Utilisateur'),
    (async (): Promise<[boolean, string[]]> => {
      if (!user) return [false, []];
      const access = await userHasAnyAgendaAccess(business.id, user.id, user.role, effectiveRole);
      return [access, access ? await listAccessibleAgendaIds(business.id, user.id, user.role, effectiveRole) : []];
    })(),
    (async (): Promise<[boolean, string[]]> => {
      if (!user) return [false, []];
      const access = await userHasAnyCabinetAccess(business.id, user.id);
      return [access, access ? await listAccessibleCabinetIds(business.id, user.id) : []];
    })(),
    userHasAccessibleChests(business.id, effectiveRole),
    userId ? getMemberDescription(business.id, userId) : null,
  ]);
  const permissions = calculatePermissionsFromEffective(effectivePermissions);

  return (
    <PermissionsProvider
      initialPermissions={permissions}
      initialRole={effectiveRole}
      initialAppSettings={appSettings}
      businessSlug={businessSlug}
      businessId={business.id}
      accessibleBusinesses={accessibleBusinesses}
      agendaModuleAccess={agendaModuleAccess}
      accessibleAgendaIds={accessibleAgendaIds}
      cabinetModuleAccess={cabinetModuleAccess}
      accessibleCabinetIds={accessibleCabinetIds}
      hasAccessibleChests={hasAccessibleChests}
    >
        <BusinessRealtimeSocketShell
          businessSlug={businessSlug}
          url={getRealtimePublicUrl()}
        >
        <QueryProvider>
          <OrdersRealtimeBridge />
          <StockRealtimeBridge />
          <MailTemplateProvider
            username={username}
            userDescription={memberDescription}
            userGender={session?.user.gender ?? 'male'}
          >
          <LoggedInShell>
          <Header
            session={authSession}
            impersonatorDisplayName={impersonatorDisplayName}
            businessSlug={businessSlug}
          />

          <div className="flex-1 w-full min-w-0 disp-mobile-tab-space min-h-0">
            {children}
          </div>
          <MobileTabBar />
        </LoggedInShell>
          </MailTemplateProvider>
        </QueryProvider>
        </BusinessRealtimeSocketShell>
    </PermissionsProvider>
  );
}
