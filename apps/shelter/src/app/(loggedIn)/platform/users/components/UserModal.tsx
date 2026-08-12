'use client';

import { useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  Group,
  MultiSelect,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { createUser, updateUser } from '@/app/_actions/users';
import { handleAction } from '@/lib/action';
import { Role, rolesAsString } from '@/types/enum/roles';
import type { User } from '@/types/users';
import { PLATFORM_ROLES } from './UsersTable';

interface UserModalProps {
  opened: boolean;
  onClose: () => void;
  editingUser: User | null;
  onSuccess: () => void;
}

const roleOptions = PLATFORM_ROLES.map((role) => ({
  value: role,
  label: rolesAsString(role),
}));

function parseUserRoles(role: string | null | undefined): Role[] {
  const parsed = (role ?? 'user')
    .split(',')
    .map((r) => r.trim())
    .filter((r): r is Role => PLATFORM_ROLES.includes(r as Role));
  return parsed.length > 0 ? parsed : [Role.USER];
}

export function UserModal({ opened, onClose, editingUser, onSuccess }: UserModalProps) {
  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      password: '',
      roles: [Role.USER] as Role[],
    },
    validate: {
      name: (value) => (value.length < 1 ? 'Le nom est requis' : null),
      email: (value) => {
        if (!editingUser && !value) return "L'email est requis";
        if (!editingUser && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Email invalide';
        }
        return null;
      },
      password: (value) => {
        if (!editingUser && !value) return 'Le mot de passe est requis';
        if (value && value.length < 8) {
          return 'Le mot de passe doit contenir au moins 8 caractères';
        }
        return null;
      },
    },
  });

  useEffect(() => {
    if (editingUser) {
      form.setValues({
        name: editingUser.name,
        email: editingUser.email,
        password: '',
        roles: parseUserRoles(editingUser.role),
      });
    } else {
      form.reset();
      form.setFieldValue('roles', [Role.USER]);
    }
  }, [editingUser, opened]);

  const handleSubmit = async (values: typeof form.values) => {
    try {
      if (editingUser) {
        const result = await updateUser({
          id: editingUser.id,
          name: values.name,
          roles: values.roles,
        });
        handleAction(result);
        notifications.show({
          title: 'Succès',
          message: 'Utilisateur modifié avec succès',
          color: 'terracotta',
        });
      } else {
        const result = await createUser({
          name: values.name,
          email: values.email,
          password: values.password,
          roles: values.roles,
        });
        handleAction(result);
        notifications.show({
          title: 'Succès',
          message: 'Utilisateur créé avec succès',
          color: 'terracotta',
        });
      }
      onClose();
      form.reset();
      onSuccess();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        form.reset();
      }}
      title={editingUser ? "Modifier l'utilisateur" : 'Créer un utilisateur'}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Nom"
            placeholder="Nom de l'utilisateur"
            required
            {...form.getInputProps('name')}
          />
          {!editingUser ? (
            <TextInput
              label="Email"
              placeholder="email@example.com"
              required
              {...form.getInputProps('email')}
            />
          ) : (
            <TextInput label="Email" value={editingUser.email} disabled readOnly />
          )}
          {!editingUser && (
            <PasswordInput
              label="Mot de passe"
              placeholder="Mot de passe (min. 8 caractères)"
              required
              {...form.getInputProps('password')}
            />
          )}
          <MultiSelect
            label="Rôles"
            data={roleOptions}
            required
            searchable
            clearable={false}
            {...form.getInputProps('roles')}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                onClose();
                form.reset();
              }}
            >
              Annuler
            </Button>
            <Button type="submit">{editingUser ? 'Enregistrer' : 'Créer'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
