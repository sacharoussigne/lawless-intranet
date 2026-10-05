'use client';

import { useMemo, useState } from 'react';
import { Button, Group, Loader, Modal, NavLink, ScrollArea, Stack, Text } from '@mantine/core';
import { IconFolder, IconHome } from '@tabler/icons-react';
import { flattenFolderTree } from '../format';
import { useMediaFolderTree } from '../hooks/useMediaQueries';

type MoveModalProps = {
  opened: boolean;
  itemName: string;
  /** Current parent (null = root): moving there is a no-op. */
  currentParentId: string | null;
  /** For folders: the folder and its subtree are not valid targets. */
  excludeFolderId?: string;
  loading?: boolean;
  onSubmit: (targetFolderId: string | null) => void;
  onClose: () => void;
};

export function MoveModal(props: MoveModalProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title={`Déplacer « ${props.itemName} »`} centered>
      {props.opened ? <MoveForm {...props} /> : null}
    </Modal>
  );
}

function MoveForm({ currentParentId, excludeFolderId, loading, onSubmit, onClose }: MoveModalProps) {
  const treeQuery = useMediaFolderTree(true);
  const [target, setTarget] = useState<string | null>(currentParentId);
  const options = useMemo(
    () => flattenFolderTree(treeQuery.data ?? [], excludeFolderId),
    [treeQuery.data, excludeFolderId],
  );

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Choisissez le dossier de destination.
      </Text>
      <ScrollArea.Autosize mah={360}>
        {treeQuery.isPending ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : (
          <Stack gap={0}>
            <NavLink
              label="Médiathèque (racine)"
              leftSection={<IconHome size={16} />}
              active={target === null}
              onClick={() => setTarget(null)}
            />
            {options.map((option) => (
              <NavLink
                key={option.id}
                label={option.name}
                leftSection={<IconFolder size={16} />}
                active={target === option.id}
                onClick={() => setTarget(option.id)}
                style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${option.depth * 20}px)` }}
              />
            ))}
          </Stack>
        )}
      </ScrollArea.Autosize>
      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="slate" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={() => onSubmit(target)} disabled={target === currentParentId} loading={loading}>
          Déplacer ici
        </Button>
      </Group>
    </Stack>
  );
}
