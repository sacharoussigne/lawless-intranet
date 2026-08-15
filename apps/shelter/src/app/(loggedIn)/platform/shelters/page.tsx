export const dynamic = 'force-dynamic';

import { listSheltersForPlatform } from '@/app/_actions/shelters';
import { SheltersPlatformClient } from './SheltersPlatformClient';
import Header from '@/app/(loggedIn)/_components/Header/Header';
import { LoggedInShell } from '@/app/(loggedIn)/_components/LoggedInShell/LoggedInShell';
import { getAuthSession } from '@/lib/authSession';
import { PermissionsProvider } from '@/app/_contexts/PermissionsContext';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import type { AuthSession } from '@/types/session';
import { getImpersonatorDisplayName } from '@/lib/auth/impersonationDisplay';
import { listAccessibleShelters } from '@/lib/shelter/context';

export default async function PlatformSheltersPage() {
  const session = await getAuthSession();
  const result = await listSheltersForPlatform();
  const impersonatorDisplayName = await getImpersonatorDisplayName(
    session?.session?.impersonatedBy,
  );
  const accessibleShelters = await listAccessibleShelters(session as AuthSession | null);

  return (
    <PermissionsProvider
      initialPermissions={null}
      initialRole={session?.user?.role ?? null}
      initialAppSettings={APP_SETTINGS_DEFAULTS}
      accessibleShelters={accessibleShelters}
    >
      <LoggedInShell>
        <Header
          session={session as AuthSession | null}
          impersonatorDisplayName={impersonatorDisplayName}
        />
        <SheltersPlatformClient
          initialShelters={result.status === 200 ? result.data ?? [] : []}
          error={result.status !== 200 ? result.error : undefined}
        />
      </LoggedInShell>
    </PermissionsProvider>
  );
}
