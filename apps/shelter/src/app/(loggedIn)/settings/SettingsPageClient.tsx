'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Container,
  FileInput,
  Group,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { handleAction } from '@/lib/action';
import { changeMyPassword, updateMyProfile } from '@/app/_actions/account';
import { useRouter } from 'next/navigation';
import type { UserGender } from '@lawless-intranet/types';

type SettingsImageMode = 'url' | 'upload';

const MAX_IMAGE_BYTES = 1_000_000;
const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Impossible de lire le fichier'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsPageClient(props: {
  initialUser: { name: string; image: string | null; gender: UserGender };
  canChangePassword: boolean;
}) {
  const router = useRouter();
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [imageMode, setImageMode] = useState<SettingsImageMode>('url');
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);

  const profileForm = useForm({
    initialValues: {
      name: props.initialUser.name,
      gender: props.initialUser.gender,
      imageUrl: typeof props.initialUser.image === 'string' ? props.initialUser.image : '',
      imageFile: null as File | null,
    },
    validate: {
      name: (value) => (value.trim().length < 1 ? 'Le nom est requis' : null),
      imageUrl: (value) => {
        if (imageMode !== 'url') return null;
        if (!value) return null;
        try {
          new URL(value);
          return null;
        } catch {
          return 'URL invalide';
        }
      },
      imageFile: (file) => {
        if (imageMode !== 'upload') return null;
        if (!file) return null;
        if (file.size > MAX_IMAGE_BYTES) return 'Image trop lourde (1MB max)';
        if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
          return 'Type non supporté (PNG, JPG, WebP)';
        }
        return null;
      },
    },
  });

  const passwordForm = useForm({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
    validate: {
      currentPassword: (value) => (value.length < 1 ? 'Le mot de passe actuel est requis' : null),
      newPassword: (value) =>
        value.length < 8 ? 'Le mot de passe doit contenir au moins 8 caractères' : null,
      confirmNewPassword: (value, values) =>
        value !== values.newPassword ? 'Les mots de passe ne correspondent pas' : null,
    },
  });

  useEffect(() => {
    if (imageMode !== 'upload' || !profileForm.values.imageFile) {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(profileForm.values.imageFile);
    setUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [imageMode, profileForm.values.imageFile]);

  const avatarPreviewSrc = useMemo(() => {
    if (imageMode === 'upload' && profileForm.values.imageFile) {
      return uploadPreviewUrl;
    }
    if (imageMode === 'url' && profileForm.values.imageUrl) {
      return profileForm.values.imageUrl;
    }
    return props.initialUser.image ?? null;
  }, [
    imageMode,
    profileForm.values.imageUrl,
    props.initialUser.image,
    uploadPreviewUrl,
    profileForm.values.imageFile,
  ]);

  const handleSaveProfile = async () => {
    try {
      const validated = profileForm.validate();
      if (validated.hasErrors) return;

      setProfileSaving(true);

      let image: string | null | undefined;
      if (imageMode === 'upload') {
        image = profileForm.values.imageFile
          ? await fileToDataUrl(profileForm.values.imageFile)
          : undefined;
      } else {
        image = profileForm.values.imageUrl ? profileForm.values.imageUrl : null;
      }

      const result = await updateMyProfile({
        name: profileForm.values.name.trim(),
        gender: profileForm.values.gender,
        image,
      });
      handleAction(result);

      notifications.show({
        title: 'Succès',
        message: 'Profil mis à jour',
        color: 'terracotta',
      });

      router.refresh();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message:
          error instanceof Error ? error.message : 'Erreur lors de la mise à jour du profil',
        color: 'danger',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePassword = async () => {
    try {
      const validated = passwordForm.validate();
      if (validated.hasErrors) return;

      setPasswordSaving(true);

      const result = await changeMyPassword({
        currentPassword: passwordForm.values.currentPassword,
        newPassword: passwordForm.values.newPassword,
      });
      handleAction(result);

      notifications.show({
        title: 'Succès',
        message: 'Mot de passe mis à jour',
        color: 'terracotta',
      });

      passwordForm.reset();
      router.refresh();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la mise à jour du mot de passe',
        color: 'danger',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={1} className="shelter-display-title">
            Paramètres du compte
          </Title>
          <Text c="dimmed" mt="xs">
            Modifiez votre profil et votre mot de passe.
          </Text>
        </div>
      </Group>

      <Stack gap="lg">
        <Card withBorder shadow="sm" radius="md" padding="lg">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Title order={3}>Profil</Title>
              <Text c="dimmed" size="sm" mt={4}>
                Username, genre et avatar.
              </Text>
            </div>
            <Avatar src={avatarPreviewSrc} radius="xl" size={56} />
          </Group>

          <Stack gap="md">
            <TextInput label="Username" required {...profileForm.getInputProps('name')} />

            <SegmentedControl
              value={profileForm.values.gender}
              onChange={(value) => profileForm.setFieldValue('gender', value as UserGender)}
              data={[
                { label: 'Masculin', value: 'male' },
                { label: 'Féminin', value: 'female' },
              ]}
              fullWidth
            />

            <SegmentedControl
              value={imageMode}
              onChange={(value) => setImageMode(value as SettingsImageMode)}
              data={[
                { label: 'URL', value: 'url' },
                { label: 'Upload', value: 'upload' },
              ]}
              fullWidth
            />

            {imageMode === 'url' ? (
              <TextInput
                label="Avatar (URL)"
                placeholder="https://..."
                {...profileForm.getInputProps('imageUrl')}
              />
            ) : (
              <FileInput
                label="Avatar (upload)"
                placeholder="PNG, JPG, WebP — 1MB max"
                accept={ACCEPTED_MIME_TYPES.join(',')}
                value={profileForm.values.imageFile}
                onChange={(file) => profileForm.setFieldValue('imageFile', file)}
                error={profileForm.errors.imageFile}
                clearable
              />
            )}

            <Group justify="flex-end">
              <Button onClick={handleSaveProfile} loading={profileSaving}>
                Enregistrer
              </Button>
            </Group>
          </Stack>
        </Card>

        {props.canChangePassword ? (
          <Card withBorder shadow="sm" radius="md" padding="lg">
            <Title order={3} mb="md">
              Mot de passe
            </Title>
            <Stack gap="md">
              <PasswordInput
                label="Mot de passe actuel"
                required
                {...passwordForm.getInputProps('currentPassword')}
              />
              <PasswordInput
                label="Nouveau mot de passe"
                required
                {...passwordForm.getInputProps('newPassword')}
              />
              <PasswordInput
                label="Confirmer le nouveau mot de passe"
                required
                {...passwordForm.getInputProps('confirmNewPassword')}
              />
              <Group justify="flex-end">
                <Button onClick={handleSavePassword} loading={passwordSaving}>
                  Changer le mot de passe
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </Container>
  );
}
