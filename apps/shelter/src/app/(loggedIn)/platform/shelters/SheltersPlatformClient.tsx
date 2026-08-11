'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  Container,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createShelter, deleteShelter } from '@/app/_actions/shelters';
import { tenantRoutes } from '@/types/routes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';

type ShelterRow = {
  id: string;
  slug: string;
  name: string;
  _count: { members: number };
  settings: { shelterName: string } | null;
};

export function SheltersPlatformClient({
  initialShelters,
  error,
}: {
  initialShelters: ShelterRow[];
  error?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShelterRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createShelter({
        name: name.trim(),
        slug: slug.trim() || undefined,
      });
      if (result.status !== 201 || !('data' in result) || !result.data) {
        const errMsg =
          'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Création impossible';
        notifications.show({ title: 'Erreur', message: errMsg, color: 'red' });
        return;
      }
      notifications.show({
        title: 'Refuge créé',
        message: result.data.name,
        color: 'teal',
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
      const result = await deleteShelter({ id });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        const errMsg =
          'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Suppression impossible';
        notifications.show({ title: 'Erreur', message: errMsg, color: 'red' });
        return;
      }
      notifications.show({
        title: 'Refuge supprimé',
        message: result.data.name,
        color: 'teal',
      });
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Container size="xl">
      <PageHeader title="Refuges" description="Gestion plateforme des refuges." />
      {error ? <Text c="red" mb="md">{error}</Text> : null}

      <Card withBorder padding="lg" radius="md" mb="xl">
        <Stack gap="sm">
          <Title order={4}>Créer un refuge</Title>
          <TextInput
            label="Nom"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="Slug (optionnel)"
            value={slug}
            onChange={(e) => setSlug(e.currentTarget.value)}
          />
          <Button
            color="teal"
            loading={loading}
            disabled={!name.trim()}
            onClick={() => void handleCreate()}
          >
            Créer
          </Button>
        </Stack>
      </Card>

      <Stack gap="md">
        {initialShelters.map((shelter) => (
          <Card key={shelter.id} withBorder padding="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={600} className="shelter-display-title">
                  {shelter.settings?.shelterName || shelter.name}
                </Text>
                <Text size="sm" c="dimmed">
                  /{shelter.slug} · {shelter._count.members} membre(s)
                </Text>
              </div>
              <Group>
                <Button
                  component={Link}
                  href={tenantRoutes(shelter.slug).employee.index}
                  variant="light"
                  color="teal"
                >
                  Ouvrir
                </Button>
                <Button color="red" variant="light" onClick={() => setDeleteTarget(shelter)}>
                  Supprimer
                </Button>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le refuge"
      >
        <Text mb="md">
          Confirmer la suppression de « {deleteTarget?.name} » ? Les données banque associées
          seront purgées.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteTarget(null)}>
            Annuler
          </Button>
          <Button
            color="red"
            loading={deleting}
            onClick={() => deleteTarget && void handleDelete(deleteTarget.id)}
          >
            Supprimer
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
