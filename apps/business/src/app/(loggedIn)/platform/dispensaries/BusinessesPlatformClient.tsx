'use client';

import { useState } from 'react';
import { Button, Card, Container, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createBusiness, deleteBusiness } from '@/app/_actions/businesses';
import { tenantRoutes } from '@/types/routes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeleteBusinessModal } from './DeleteBusinessModal';

type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  _count: { members: number };
  settings: { businessName: string } | null;
};

export function BusinessesPlatformClient({
  initialBusinesses,
  error,
}: {
  initialBusinesses: BusinessRow[];
  error?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusinessRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createBusiness({
        name: name.trim(),
        slug: slug.trim() || undefined,
      });
      if (result.status !== 201 || !('data' in result) || !result.data) {
        const errMsg =
          'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Création impossible';
        notifications.show({
          title: 'Erreur',
          message: errMsg,
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Entreprise créée',
        message: result.data.name,
        color: 'moss',
      });
      setName('');
      setSlug('');
      router.refresh();
      router.push(tenantRoutes(result.data.slug).employee.index);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const result = await deleteBusiness({ id });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        const errMsg =
          'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Suppression impossible';
        notifications.show({
          title: 'Erreur',
          message: errMsg,
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Entreprise supprimée',
        message: result.data.name,
        color: 'moss',
      });
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Container size="xl" py="xl" w="100%">
      <Stack gap="lg">
        <Title order={2}>Entreprises (plateforme)</Title>
        {error && (
          <Text c="danger" size="sm">
            {error}
          </Text>
        )}

        <Card withBorder padding="md">
          <Stack gap="sm">
            <Text fw={600}>Créer une entreprise</Text>
            <TextInput label="Nom" value={name} onChange={(e) => setName(e.currentTarget.value)} />
            <TextInput
              label="Slug (URL)"
              description="Optionnel — généré depuis le nom si vide"
              value={slug}
              onChange={(e) => setSlug(e.currentTarget.value)}
            />
            <Button
              color="sage"
              loading={loading}
              onClick={handleCreate}
              disabled={!name.trim()}
            >
              Créer
            </Button>
          </Stack>
        </Card>

        <Stack gap="sm">
          {initialBusinesses.map((d) => {
            const displayName = d.settings?.businessName ?? d.name;
            return (
              <Card key={d.id} withBorder padding="md">
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>{displayName}</Text>
                    <Text size="sm" c="dimmed">
                      /{d.slug} — {d._count.members} membre(s)
                    </Text>
                  </div>
                  <Group gap="sm">
                    <Button
                      component={Link}
                      href={tenantRoutes(d.slug).employee.index}
                      variant="light"
                    >
                      Ouvrir
                    </Button>
                    <Button color="danger" variant="light" onClick={() => setDeleteTarget(d)}>
                      Supprimer
                    </Button>
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      </Stack>

      <DeleteBusinessModal
        opened={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        business={
          deleteTarget
            ? {
                id: deleteTarget.id,
                name: deleteTarget.name,
                displayName: deleteTarget.settings?.businessName ?? deleteTarget.name,
                membersCount: deleteTarget._count.members,
              }
            : null
        }
        loading={deleting}
        onConfirm={handleDelete}
      />
    </Container>
  );
}
