import Header from '@/app/(loggedIn)/_components/Header/Header';
import { LoggedInShell } from '@/app/(loggedIn)/_components/LoggedInShell/LoggedInShell';
import { getAuthSession } from '@/lib/authSession';
import type { AuthSession } from '@/types/session';
import { getImpersonatorDisplayName } from '@/lib/auth/impersonationDisplay';
import { PermissionsProvider } from '@/app/_contexts/PermissionsContext';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import { listAccessibleBusinesses } from '@/lib/business/context';

export default async function AdminPlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  const impersonatorDisplayName = await getImpersonatorDisplayName(session?.session?.impersonatedBy);
  const accessibleBusinesses = await listAccessibleBusinesses(session as AuthSession | null);

  return (
    <PermissionsProvider
      initialPermissions={null}
      initialRole={session?.user?.role ?? null}
      initialAppSettings={APP_SETTINGS_DEFAULTS}
      accessibleBusinesses={accessibleBusinesses}
    >
      <LoggedInShell>
        <Header
          session={session as AuthSession | null}
          impersonatorDisplayName={impersonatorDisplayName}
        />
        <div className="flex-1 w-full min-w-0 disp-mobile-safe-space">
          {children}
        </div>
      </LoggedInShell>
    </PermissionsProvider>
  );
}
