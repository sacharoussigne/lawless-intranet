import Header from '@/app/(loggedIn)/_components/Header/Header';
import { LoggedInShell } from '@/app/(loggedIn)/_components/LoggedInShell/LoggedInShell';
import { ShelterClientProviders } from '@/app/(loggedIn)/_components/ShelterClientProviders/ShelterClientProviders';
import { getAuthSession } from '@/lib/authSession';
import { PermissionsProvider } from '@/app/_contexts/PermissionsContext';
import { calculatePermissionsFromEffective } from '@/lib/auth/calculatePermissions';
import { getAppSettings } from '@/lib/appSettings';
import type { AuthSession } from '@/types/session';
import {
  listAccessibleShelters,
  requireShelterFromSlug,
  getEffectiveRoleForShelter,
  userCanAccessShelter,
  resolveShelterAccessDeniedRedirect,
} from '@/lib/shelter/context';
import { resolveEffectivePermissionsForShelter } from '@/lib/shelter/permissionsResolve';
import { getImpersonatorDisplayName } from '@/lib/auth/impersonationDisplay';
import { notFound, redirect } from 'next/navigation';

export default async function ShelterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  const session = await getAuthSession();
  const shelter = await requireShelterFromSlug(shelterSlug).catch(() => null);

  if (!shelter) {
    notFound();
  }

  const authSession = session as AuthSession | null;
  const canAccess = await userCanAccessShelter(authSession, shelter.id);
  if (!canAccess && session) {
    const target = await resolveShelterAccessDeniedRedirect(
      session,
      `/s/${encodeURIComponent(shelterSlug)}/employee`,
    );
    redirect(target);
  }

  const [effectiveRole, appSettings, accessibleShelters, impersonatorDisplayName] =
    await Promise.all([
      getEffectiveRoleForShelter(authSession, shelter.id),
      getAppSettings(shelter.id),
      listAccessibleShelters(authSession),
      getImpersonatorDisplayName(session?.session?.impersonatedBy),
    ]);

  const effectivePermissions = await resolveEffectivePermissionsForShelter(
    authSession,
    shelter.id,
    effectiveRole,
  );
  const permissions = calculatePermissionsFromEffective(effectivePermissions);

  return (
    <PermissionsProvider
      initialPermissions={permissions}
      initialRole={effectiveRole}
      initialAppSettings={appSettings}
      shelterSlug={shelterSlug}
      shelterId={shelter.id}
      accessibleShelters={accessibleShelters}
    >
      <LoggedInShell>
        <ShelterClientProviders shelterSlug={shelterSlug}>
          <Header
            session={authSession}
            shelterSlug={shelterSlug}
            impersonatorDisplayName={impersonatorDisplayName}
          />
          <div className="flex-1 w-full min-w-0 pb-8 min-h-0">{children}</div>
        </ShelterClientProviders>
      </LoggedInShell>
    </PermissionsProvider>
  );
}
