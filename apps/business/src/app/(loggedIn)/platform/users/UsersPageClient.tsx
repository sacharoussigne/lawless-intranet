'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Title,
  Group,
  Button,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { handleAction } from '@/lib/action';
import { fetchPlatformRead } from '@/lib/read/fetchPlatformRead';
import { notifications } from '@mantine/notifications';
import { UserModal } from './components/UserModal';
import { DeleteUserModal } from './components/DeleteUserModal';
import { PasswordModal } from './components/PasswordModal';
import { UsersTable } from './components/UsersTable';
import { ActiveFilters } from '@/app/_components/ActiveFilters/ActiveFilters';
import { authClient } from '@lawless-intranet/auth-client/browser';
import { useRouter } from 'next/navigation';
import type { User } from '@/types/users';
import { toUsersPage, USERS_PAGE_SIZE } from './usersPage';

interface UsersPageClientProps {
  initialUsers: User[];
  initialTotalRecords: number;
}

export default function UsersPageClient({
  initialUsers,
  initialTotalRecords,
}: UsersPageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [passwordModalOpened, setPasswordModalOpened] = useState(false);
  const [userForPassword, setUserForPassword] = useState<User | null>(null);

  const [emailFilter, setEmailFilter] = useState<string>('');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = USERS_PAGE_SIZE;

  useEffect(() => {
    // Récupérer l'ID de l'utilisateur actuel
    authClient.getSession().then((session) => {
      if (session?.data?.user?.id) {
        setCurrentUserId(session.data.user.id);
      }
    });
  }, []);

  const isInitialKey = page === 1 && !emailFilter && !nameFilter;
  const usersQuery = useQuery({
    queryKey: ['platform', 'users', { page, emailFilter, nameFilter }],
    queryFn: async () =>
      toUsersPage(
        handleAction(
          await fetchPlatformRead('', 'users', {
            searchValue: emailFilter || nameFilter || undefined,
            searchField: emailFilter ? 'email' : 'name',
            limit: pageSize,
            offset: (page - 1) * pageSize,
            sortBy: 'createdAt',
            sortDirection: 'desc',
          }),
        ),
      ),
    initialData: isInitialKey ? { users: initialUsers, total: initialTotalRecords } : undefined,
    placeholderData: keepPreviousData,
  });
  const users = usersQuery.data?.users ?? [];
  const totalRecords = usersQuery.data?.total ?? 0;
  // After a creation, an edit or a deletion: every page and filter of the list.
  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ['platform', 'users'] });

  useEffect(() => {
    if (usersQuery.error) {
      notifications.show({
        title: 'Erreur',
        message: usersQuery.error.message || 'Erreur lors du chargement des utilisateurs',
        color: 'danger',
      });
    }
  }, [usersQuery.error]);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setModalOpened(true);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setModalOpened(true);
  };

  const openPasswordModal = (user: User) => {
    setUserForPassword(user);
    setPasswordModalOpened(true);
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const result = await authClient.admin.impersonateUser({ userId });

      if (result.error) {
        throw new Error(result.error.message || 'Erreur lors de l\'impersonation');
      }

      notifications.show({
        title: 'Succès',
        message: 'Connexion en tant qu\'utilisateur réussie',
        color: 'moss',
      });

      router.refresh();
      window.location.href = '/';
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message:
          error instanceof Error ? error.message : 'Erreur lors de l\'impersonation',
        color: 'danger',
      });
    }
  };

  // Filtrer les utilisateurs côté client pour le filtre de rôle
  const filteredUsers = users.filter((user) => {
    const matchesRole =
      !roleFilter || (user.role && user.role.split(',').map((r: string) => r.trim()).includes(roleFilter));
    return matchesRole;
  });

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>Utilisateurs</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Créer un utilisateur
        </Button>
      </Group>

      <ActiveFilters
        filters={[
          {
            label: 'Nom',
            value: nameFilter,
            onRemove: () => setNameFilter(''),
          },
          {
            label: 'Email',
            value: emailFilter,
            onRemove: () => setEmailFilter(''),
          },
          {
            label: 'Rôle',
            value: roleFilter,
            onRemove: () => setRoleFilter(null),
          },
        ]}
      />

      <UsersTable
        users={filteredUsers}
        loading={usersQuery.isFetching}
        currentUserId={currentUserId}
        nameFilter={nameFilter}
        emailFilter={emailFilter}
        roleFilter={roleFilter}
        page={page}
        pageSize={pageSize}
        totalRecords={totalRecords}
        onNameFilterChange={(value) => {
          setNameFilter(value);
          setPage(1);
        }}
        onEmailFilterChange={(value) => {
          setEmailFilter(value);
          setPage(1);
        }}
        onRoleFilterChange={(value) => setRoleFilter(value)}
        onPageChange={(p) => setPage(p)}
        onEdit={handleEdit}
        onDelete={(user) => {
          setUserToDelete(user);
          setDeleteModalOpened(true);
        }}
        onPasswordChange={openPasswordModal}
        onImpersonate={handleImpersonate}
      />

      <UserModal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditingUser(null);
        }}
        editingUser={editingUser}
        onSuccess={refreshUsers}
      />

      <PasswordModal
        opened={passwordModalOpened}
        onClose={() => {
          setPasswordModalOpened(false);
          setUserForPassword(null);
        }}
        userForPassword={userForPassword}
        onSuccess={() => {
          setPasswordModalOpened(false);
          setUserForPassword(null);
        }}
      />

      <DeleteUserModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setUserToDelete(null);
        }}
        userToDelete={userToDelete}
        onSuccess={refreshUsers}
      />
    </Container>
  );
}

