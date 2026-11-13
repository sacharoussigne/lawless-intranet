export const dynamic = 'force-dynamic';

import { listUsers } from '@/app/_actions/users';
import UsersPageClient from './UsersPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { toUsersPage, USERS_PAGE_SIZE } from './usersPage';

async function UsersContent() {
  const result = await listUsers({
    limit: USERS_PAGE_SIZE,
    offset: 0,
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });
  const { users, total } = toUsersPage(getDataOrThrow(result, 'Erreur lors du chargement des utilisateurs'));

  return <UsersPageClient initialUsers={users} initialTotalRecords={total} />;
}

export default function PlatformUsersPage() {
  return (
    <SuspenseLoader>
      <UsersContent />
    </SuspenseLoader>
  );
}
