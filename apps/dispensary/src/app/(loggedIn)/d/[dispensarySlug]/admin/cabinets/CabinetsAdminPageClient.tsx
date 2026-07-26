'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconEdit, IconPlus, IconTrash, IconUsers } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { listCabinetsForAdmin } from '@/app/_actions/cabinet/cabinets';
import { handleAction } from '@/lib/action';
import { CabinetMembersModal } from '../../cabinet/components/CabinetMembersModal';
import { CabinetFormModal } from './components/CabinetFormModal';
import { DeleteCabinetModal } from './components/DeleteCabinetModal';

type AdminCabinet = {
  id: string;
  name: string;
  description: string | null;
  _count: { members: number; patients: number };
};

interface CabinetsAdminPageClientProps {
  dispensarySlug: string;
  initialCabinets: AdminCabinet[];
  error?: string;
}

export function CabinetsAdminPageClient({
  dispensarySlug,
  initialCabinets,
  error,
}: CabinetsAdminPageClientProps) {
  const [cabinets, setCabinets] = useState(initialCabinets);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCabinet | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersCabinet, setMembersCabinet] = useState<AdminCabinet | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCabinet, setDeleteCabinet] = useState<AdminCabinet | null>(null);

  const reload = async () => {
    try {
      const result = await listCabinetsForAdmin(dispensarySlug);
      const data = handleAction(result);
      if (data) setCabinets(data as AdminCabinet[]);
    } catch (err: unknown) {
      notifications.show({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Rechargement impossible',
        color: 'danger',
      });
    }
  };

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Cabinets"
        description="Créer et gérer les cabinets médicaux du dispensaire."
        actions={
          <Button
            color="sage"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Nouveau cabinet
          </Button>
        }
      />

      {error && <Text c="dimmed" mb="md">{error}</Text>}

      <DataTable
        withTableBorder
        borderRadius="sm"
        highlightOnHover
        records={cabinets}
        columns={[
          { accessor: 'name', title: 'Nom' },
          {
            accessor: 'description',
            title: 'Description',
            render: (c) => c.description || '—',
          },
          {
            accessor: '_count.members',
            title: 'Membres',
            render: (c) => c._count.members,
          },
          {
            accessor: '_count.patients',
            title: 'Patients',
            render: (c) => c._count.patients,
          },
          {
            accessor: 'actions',
            title: '',
            textAlign: 'right',
            render: (c) => (
              <Group gap="xs" justify="flex-end" wrap="nowrap">
                <ActionIcon
                  variant="light"
                  color="slate"
                  onClick={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                >
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="leather"
                  onClick={() => {
                    setMembersCabinet(c);
                    setMembersOpen(true);
                  }}
                >
                  <IconUsers size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="danger"
                  onClick={() => {
                    setDeleteCabinet(c);
                    setDeleteOpen(true);
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ),
          },
        ]}
        emptyState={
          <Stack align="center" py="xl">
            <Text c="dimmed">Aucun cabinet. Créez-en un pour commencer.</Text>
          </Stack>
        }
      />

      <CabinetFormModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        dispensarySlug={dispensarySlug}
        cabinet={editing}
        onSuccess={reload}
      />

      <CabinetMembersModal
        opened={membersOpen}
        onClose={() => setMembersOpen(false)}
        dispensarySlug={dispensarySlug}
        cabinetId={membersCabinet?.id ?? null}
        cabinetName={membersCabinet?.name ?? ''}
      />

      <DeleteCabinetModal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        dispensarySlug={dispensarySlug}
        cabinetId={deleteCabinet?.id ?? null}
        cabinetName={deleteCabinet?.name ?? ''}
        onSuccess={reload}
      />
    </Container>
  );
}
