import Header from '@/app/(loggedIn)/_components/Header/Header';
import { LoggedInShell } from '@/app/(loggedIn)/_components/LoggedInShell/LoggedInShell';
import { getAuthSession } from '@/lib/authSession';
import { PermissionsProvider } from '@/app/_contexts/PermissionsContext';
import { calculatePermissions } from '@/lib/auth/calculatePermissions';
import { getAppSettings } from '@/lib/appSettings';
import type { AuthSession } from '@/types/session';
import { getImpersonatorDisplayName } from '@/lib/auth/impersonationDisplay';
import {
  listAccessibleDispensaries,
  requireDispensaryFromSlug,
  getEffectiveRoleForDispensary,
  userCanAccessDispensary,
  resolveDispensaryAccessDeniedRedirect,
} from '@/lib/dispensary/context';
import { notFound, redirect } from 'next/navigation';
import { userHasAnyAgendaAccess, listAccessibleAgendaIds } from '@/lib/agenda/access';
import {
  userHasAnyCabinetAccess,
  listAccessibleCabinetIds,
} from '@/lib/cabinet/access';
import { DispensaryRealtimeShell } from './DispensaryRealtimeShell';
import { QueryProvider } from '@/lib/react-query/QueryProvider';
import { getMemberDescription } from '@/lib/dispensary/memberDescription';
import { MailTemplateProvider } from '@lawless-intranet/mail-template-ui';

export default async function DispensaryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  const session = await getAuthSession();
  const dispensary = await requireDispensaryFromSlug(dispensarySlug).catch(() => null);

  if (!dispensary) {
    notFound();
  }

  const authSession = session as AuthSession | null;
  const canAccess = await userCanAccessDispensary(authSession, dispensary.id);
  if (!canAccess && session) {
    const target = await resolveDispensaryAccessDeniedRedirect(
      session,
      `/d/${encodeURIComponent(dispensarySlug)}/employee`,
    );
    redirect(target);
  }

  const [
    impersonatorDisplayName,
    effectiveRole,
    appSettings,
    accessibleDispensaries,
  ] = await Promise.all([
    getImpersonatorDisplayName(session?.session?.impersonatedBy),
    getEffectiveRoleForDispensary(authSession, dispensary.id),
    getAppSettings(dispensary.id),
    listAccessibleDispensaries(authSession),
  ]);

  const permissions = calculatePermissions(effectiveRole);
  const userId = session?.user?.id;
  const agendaModuleAccess = userId
    ? await userHasAnyAgendaAccess(
        dispensary.id,
        userId,
        session.user.role,
        effectiveRole,
      )
    : false;
  const accessibleAgendaIds =
    userId && agendaModuleAccess
      ? await listAccessibleAgendaIds(
          dispensary.id,
          userId,
          session.user.role,
          effectiveRole,
        )
      : [];
  const cabinetModuleAccess = userId
    ? await userHasAnyCabinetAccess(dispensary.id, userId)
    : false;
  const accessibleCabinetIds =
    userId && cabinetModuleAccess
      ? await listAccessibleCabinetIds(dispensary.id, userId)
      : [];
  const memberDescription = userId
    ? await getMemberDescription(dispensary.id, userId)
    : null;

  return (
    <PermissionsProvider
      initialPermissions={permissions}
      initialRole={effectiveRole}
      initialAppSettings={appSettings}
      dispensarySlug={dispensarySlug}
      dispensaryId={dispensary.id}
      accessibleDispensaries={accessibleDispensaries}
      agendaModuleAccess={agendaModuleAccess}
      accessibleAgendaIds={accessibleAgendaIds}
      cabinetModuleAccess={cabinetModuleAccess}
      accessibleCabinetIds={accessibleCabinetIds}
    >
      <DispensaryRealtimeShell>
        <QueryProvider>
          <MailTemplateProvider
            username={session?.user.name ?? 'Utilisateur'}
            userDescription={memberDescription}
            userGender={session?.user.gender ?? 'male'}
          >
          <LoggedInShell>
          <Header
            session={authSession}
            impersonatorDisplayName={impersonatorDisplayName}
            dispensarySlug={dispensarySlug}
          />

          <div className="flex-1 w-full min-w-0 pb-[72px] sm:pb-0 min-h-0">
            {children}
          </div>
        </LoggedInShell>
          </MailTemplateProvider>
        </QueryProvider>
      </DispensaryRealtimeShell>
    </PermissionsProvider>
  );
}
