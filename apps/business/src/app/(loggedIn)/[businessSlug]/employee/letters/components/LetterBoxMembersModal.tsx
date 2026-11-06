'use client';

import { useCallback, useState } from 'react';
import { ActionIcon, Avatar, Group, Loader, Select, Stack, Text } from '@mantine/core';
import { IconTrash, IconUsers } from '@tabler/icons-react';
import { AppModal } from '@/app/_components/AppModal/AppModal';
import { UserPseudoSearch } from '@/app/_components/UserPseudoSearch/UserPseudoSearch';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import { removeLetterBoxMember, upsertLetterBoxMember } from '@/app/_actions/letters/members';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import {
  LETTER_BOX_ACCESS_LEVELS,
  letterBoxAccessLevelLabel,
  type LetterBoxAccessLevel,
} from '@/types/letters';
import { useLetterBoxMembers, useLetterBoxMutation } from '../hooks/useLettersQueries';

const LEVEL_OPTIONS = LETTER_BOX_ACCESS_LEVELS.map((level) => ({ value: level, label: letterBoxAccessLevelLabel(level) }));

/** Who can open the box: the owner adds people in reading or writing (or as co-owner). */
export function LetterBoxMembersModal({
  opened,
  onClose,
  boxId,
  boxName,
  onChanged,
}: {
  opened: boolean;
  onClose: () => void;
  boxId: string | null;
  boxName: string;
  onChanged?: () => void;
}) {
  const slug = useRequiredBusinessSlug();
  const members = useLetterBoxMembers(boxId, opened);
  const [newLevel, setNewLevel] = useState<LetterBoxAccessLevel>('READ');
  const upsert = useLetterBoxMutation(
    boxId,
    (businessSlug, vars: { userId: string; accessLevel: LetterBoxAccessLevel }, meta) =>
      upsertLetterBoxMember(businessSlug, { boxId: boxId ?? '', ...vars }, meta),
    { success: 'Accès mis à jour', error: 'Mise à jour impossible' },
  );
  const remove = useLetterBoxMutation(
    boxId,
    (businessSlug, userId: string, meta) => removeLetterBoxMember(businessSlug, { boxId: boxId ?? '', userId }, meta),
    { success: 'Accès retiré', error: 'Retrait impossible' },
  );
  const search = useCallback(
    async (query: string) => handleAction(await fetchRead(slug, 'letterUserSearch', { boxId: boxId ?? undefined, query })) ?? [],
    [boxId, slug],
  );
  const list = members.data?.members ?? [];
  const canManage = members.data?.canManage ?? false;
  const after = () => onChanged?.();

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Accès à la boîte"
      description={boxName}
      icon={IconUsers}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Lecture : voir les lettres. Écriture : ajouter, modifier, archiver. Propriétaire : gérer aussi les accès.
        </Text>
        {members.isLoading ? (
          <Loader color="sage" size="sm" />
        ) : (
          <Stack gap="xs">
            {list.map((member) => (
              <Group key={member.userId} gap="sm" wrap="nowrap">
                <Avatar src={member.image} radius="xl" size={32} color="sage">
                  {member.name.slice(0, 1).toUpperCase()}
                </Avatar>
                <Text size="sm" style={{ flex: 1 }} truncate="end">
                  {member.name}
                </Text>
                <Select
                  size="xs"
                  w={140}
                  data={LEVEL_OPTIONS}
                  value={member.accessLevel}
                  disabled={!canManage}
                  allowDeselect={false}
                  onChange={(value) => {
                    if (value) upsert.mutate({ userId: member.userId, accessLevel: value as LetterBoxAccessLevel }, { onSuccess: after });
                  }}
                />
                {canManage ? (
                  <ActionIcon
                    variant="light"
                    color="danger"
                    aria-label={`Retirer ${member.name}`}
                    onClick={() => remove.mutate(member.userId, { onSuccess: after })}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                ) : null}
              </Group>
            ))}
          </Stack>
        )}
        {canManage ? (
          <Stack gap="xs">
            <hr className="disp-section-divider" />
            <Select
              label="Niveau pour la personne ajoutée"
              size="xs"
              w={220}
              data={LEVEL_OPTIONS}
              value={newLevel}
              allowDeselect={false}
              onChange={(value) => value && setNewLevel(value as LetterBoxAccessLevel)}
            />
            <UserPseudoSearch
              label="Donner l’accès à"
              description="Membre de l’entreprise, par son pseudo"
              inputName="letter-box-member-search"
              enabled={opened}
              excludeUserIds={list.map((member) => member.userId)}
              onSearch={search}
              onSelect={(user) => upsert.mutate({ userId: user.id, accessLevel: newLevel }, { onSuccess: after })}
              actionLabel="Ajouter"
            />
          </Stack>
        ) : null}
      </Stack>
    </AppModal>
  );
}
