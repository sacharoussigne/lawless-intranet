export const dynamic = 'force-dynamic';

import { listUsers } from '@/app/_actions/users';
import UsersPageClient from './UsersPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import type { User } from '@/types/users';
import Header from '@/app/(loggedIn)/_components/Header/Header';
import { LoggedInShell } from '@/app/(loggedIn)/_components/LoggedInShell/LoggedInShell';
import { getAuthSession } from '@/lib/authSession';
import { PermissionsProvider } from '@/app/_contexts/PermissionsContext';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import type { AuthSession } from '@/types/session';
import { getImpersonatorDisplayName } from '@/lib/auth/impersonationDisplay';
import { listAccessibleShelters } from '@/lib/shelter/context';

async function UsersContent() {
  const result = await listUsers({
    limit: 10,
    offset: 0,
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  const data = getDataOrThrow(result, 'Erreur lors du chargement des utilisateurs');

  const users: User[] = ((data as { users?: User[] }).users || []).map((user) => ({
    ...(user as User),
    role: (user as { role?: string | null }).role ?? null,
  }));

  return (
    <UsersPageClient
      initialUsers={users}
      initialTotalRecords={(data as { total?: number }).total || 0}
    />
  );
}

export default async function PlatformUsersPage() {
  const session = await getAuthSession();
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
        <SuspenseLoader>
          <UsersContent />
        </SuspenseLoader>
      </LoggedInShell>
    </PermissionsProvider>
  );
}
