'use client';

import { useCallback, useState } from 'react';
import { ActionIcon, Avatar, Button, Container, Group, Stack, Text, TextInput, Textarea, Tooltip } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconEdit, IconMailbox, IconPlus, IconTrash, IconUsers } from '@tabler/icons-react';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { UserPseudoSearch } from '@/app/_components/UserPseudoSearch/UserPseudoSearch';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import { createLetterBox, deleteLetterBox, updateLetterBox } from '@/app/_actions/letters/boxes';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { lettersKeys } from '@/lib/letters/queryKeys';
import type { LetterBoxAdminDTO } from '@/types/letters';
import { LetterBoxMembersModal } from '../../employee/letters/components/LetterBoxMembersModal';

type FormState = { key: number; box: LetterBoxAdminDTO | null } | null;

function LetterBoxFormModal({ box, onClose }: { box: LetterBoxAdminDTO | null; onClose: () => void }) {
  const slug = useRequiredBusinessSlug();
  const queryClient = useQueryClient();
  const [name, setName] = useState(box?.name ?? '');
  const [description, setDescription] = useState(box?.description ?? '');
  const [ownerQuery, setOwnerQuery] = useState('');
  const [owner, setOwner] = useState<{ id: string; name: string } | null>(null);
  const search = useCallback(
    async (query: string) => handleAction(await fetchRead(slug, 'letterUserSearch', { query })) ?? [],
    [slug],
  );
  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), description: description.trim() || null };
      return handleAction(
        box
          ? await updateLetterBox(slug, { id: box.id, ...payload })
          : await createLetterBox(slug, { ...payload, ownerUserId: owner?.id ?? '' }),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lettersKeys.admin(slug) });
      notifications.show({ title: 'Lettres', message: box ? 'Boîte modifiée' : 'Boîte créée', color: 'moss' });
      onClose();
    },
    onError: (error: Error) => notifications.show({ title: 'Erreur', message: error.message, color: 'danger' }),
  });

  return (
    <AppModal
      opened
      onClose={onClose}
      title={box ? 'Modifier la boîte aux lettres' : 'Nouvelle boîte aux lettres'}
      icon={IconMailbox}
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button
            color="sage"
            loading={save.isPending}
            disabled={!name.trim() || (!box && !owner)}
            onClick={() => save.mutate()}
          >
            {box ? 'Enregistrer' : 'Créer'}
          </Button>
        </AppModalFooter>
      }
    >
      <TextInput
        label="Nom"
        placeholder="Ex. Boîte de Jess"
        data-autofocus
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        {...noAutofillProps}
      />
      <Textarea
        label="Description"
        autosize
        minRows={2}
        value={description}
        onChange={(event) => setDescription(event.currentTarget.value)}
        {...noAutofillProps}
      />
      {!box ? (
        <Stack gap={4}>
          <UserPseudoSearch
            label="Propriétaire"
            description="La personne qui choisira ensuite qui a accès à sa boîte"
            inputName="letter-box-owner-search"
            query={ownerQuery}
            onQueryChange={(next) => {
              setOwnerQuery(next);
              if (owner && next !== owner.name) setOwner(null);
            }}
            onSearch={search}
            onSelect={(user) => {
              setOwner(user);
              setOwnerQuery(user.name);
            }}
            hideResults={owner !== null}
            clearQueryOnSelect={false}
          />
          {owner ? (
            <Text size="sm" c="dimmed">
              Propriétaire : {owner.name}
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </AppModal>
  );
}

/** Admin › boxes: an admin creates a box for a person; that person then shares it. */
export function LetterBoxesAdminPageClient({ initialBoxes }: { initialBoxes: LetterBoxAdminDTO[] }) {
  const slug = useRequiredBusinessSlug();
  const queryClient = useQueryClient();
  const boxes = useQuery({
    queryKey: lettersKeys.admin(slug),
    queryFn: async () => handleAction(await fetchRead(slug, 'adminLetterBoxes')),
    initialData: initialBoxes,
  });
  const [form, setForm] = useState<FormState>(null);
  const [membersBox, setMembersBox] = useState<LetterBoxAdminDTO | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: lettersKeys.admin(slug) });
  const remove = async (box: LetterBoxAdminDTO) => {
    try {
      handleAction(await deleteLetterBox(slug, { id: box.id }));
      notifications.show({ title: 'Lettres', message: 'Boîte supprimée', color: 'moss' });
      await refresh();
    } catch (error) {
      notifications.show({ title: 'Erreur', message: error instanceof Error ? error.message : 'Échec', color: 'danger' });
    }
  };

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Boîtes aux lettres"
        description="Une boîte par personne : son propriétaire choisit ensuite qui peut lire ou ajouter des lettres."
        actions={
          <Button color="sage" leftSection={<IconPlus size={16} />} onClick={() => setForm({ key: Date.now(), box: null })}>
            Nouvelle boîte
          </Button>
        }
      />
      <DataTable
        withTableBorder
        borderRadius="sm"
        highlightOnHover
        records={boxes.data ?? []}
        columns={[
          { accessor: 'name', title: 'Nom' },
          { accessor: 'description', title: 'Description', render: (box) => box.description || '—' },
          {
            accessor: 'members',
            title: 'Accès',
            render: (box) => (
              <Avatar.Group>
                {box.members.slice(0, 5).map((member) => (
                  <Tooltip key={member.userId} label={`${member.name} (${member.accessLevel === 'OWNER' ? 'propriétaire' : member.accessLevel === 'WRITE' ? 'écriture' : 'lecture'})`}>
                    <Avatar src={member.image} radius="xl" size={28} color="sage">
                      {member.name.slice(0, 1).toUpperCase()}
                    </Avatar>
                  </Tooltip>
                ))}
                {box.members.length > 5 ? <Avatar radius="xl" size={28}>+{box.members.length - 5}</Avatar> : null}
              </Avatar.Group>
            ),
          },
          { accessor: 'letterCount', title: 'Lettres' },
          {
            accessor: 'actions',
            title: '',
            textAlign: 'right',
            render: (box) => (
              <Group gap="xs" justify="flex-end" wrap="nowrap">
                <ActionIcon variant="light" color="slate" aria-label="Modifier" onClick={() => setForm({ key: Date.now(), box })}>
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon variant="light" color="leather" aria-label="Accès" onClick={() => setMembersBox(box)}>
                  <IconUsers size={16} />
                </ActionIcon>
                <DeleteConfirmPopover
                  title="Supprimer la boîte ?"
                  message={`« ${box.name} », ses ${box.letterCount} lettre(s) et leurs images seront supprimées définitivement.`}
                  onConfirm={() => remove(box)}
                >
                  <ActionIcon variant="light" color="danger" aria-label="Supprimer">
                    <IconTrash size={16} />
                  </ActionIcon>
                </DeleteConfirmPopover>
              </Group>
            ),
          },
        ]}
        emptyState={
          <Stack align="center" py="xl">
            <Text c="dimmed">Aucune boîte aux lettres. Créez-en une pour une personne.</Text>
          </Stack>
        }
      />
      {form ? <LetterBoxFormModal key={form.key} box={form.box} onClose={() => setForm(null)} /> : null}
      <LetterBoxMembersModal
        opened={membersBox !== null}
        onClose={() => setMembersBox(null)}
        boxId={membersBox?.id ?? null}
        boxName={membersBox?.name ?? ''}
        onChanged={() => void refresh()}
      />
    </Container>
  );
}
