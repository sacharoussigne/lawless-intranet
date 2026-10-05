'use client';

import Link from 'next/link';
import { ActionIcon, Card, Center, Group, Image, Menu, Stack, Text, UnstyledButton } from '@mantine/core';
import {
  IconArrowsMove,
  IconDots,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconFolder,
  IconPencil,
  IconPhoto,
  IconTrash,
} from '@tabler/icons-react';
import type { MediaFileRecord, MediaFolderRecord } from '@lawless-intranet/types';
import { formatBytes, getFileKind } from '../format';
import { useMediaUi } from '../MediaUiProvider';

const THUMB_HEIGHT = 120;

type ItemActions = {
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
};

function ItemMenu({
  label,
  children,
  onRename,
  onMove,
  onDelete,
}: ItemActions & { label: string; children?: React.ReactNode }) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="slate" aria-label={`Actions pour ${label}`}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {children}
        <Menu.Item leftSection={<IconPencil size={14} />} onClick={onRename}>
          Renommer
        </Menu.Item>
        <Menu.Item leftSection={<IconArrowsMove size={14} />} onClick={onMove}>
          Déplacer
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="danger" leftSection={<IconTrash size={14} />} onClick={onDelete}>
          Supprimer
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export function FolderCard({
  folder,
  href,
  ...actions
}: ItemActions & { folder: MediaFolderRecord; href: string }) {
  return (
    <Card withBorder padding="sm" radius="md">
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <UnstyledButton component={Link} href={href} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="sm" wrap="nowrap">
            <IconFolder size={28} stroke={1.5} color="var(--mantine-primary-color-filled)" />
            <Text size="sm" fw={500} lineClamp={2}>
              {folder.name}
            </Text>
          </Group>
        </UnstyledButton>
        <ItemMenu label={folder.name} {...actions} />
      </Group>
    </Card>
  );
}

export function FileCard({
  file,
  onPreview,
  onDownload,
  ...actions
}: ItemActions & { file: MediaFileRecord; onPreview: () => void; onDownload: () => void }) {
  const { formatDate } = useMediaUi();
  const kind = getFileKind(file.mimeType);

  return (
    <Card withBorder padding="sm" radius="md">
      <Card.Section>
        <UnstyledButton onClick={onPreview} style={{ display: 'block', width: '100%' }} aria-label={`Aperçu de ${file.name}`}>
          {kind === 'image' && file.previewUrl ? (
            <Image src={file.previewUrl} alt={file.name} h={THUMB_HEIGHT} fit="cover" loading="lazy" />
          ) : (
            <Center h={THUMB_HEIGHT} bg="var(--mantine-color-default-hover)">
              {kind === 'pdf' ? (
                <IconFileTypePdf size={44} stroke={1.25} color="var(--mantine-color-danger-6)" />
              ) : (
                <IconPhoto size={44} stroke={1.25} color="var(--mantine-color-dimmed)" />
              )}
            </Center>
          )}
        </UnstyledButton>
      </Card.Section>
      <Group justify="space-between" wrap="nowrap" gap="xs" mt="sm" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={500} lineClamp={2} title={file.name}>
            {file.name}
          </Text>
          <Text size="xs" c="dimmed">
            {formatBytes(file.size)} · {formatDate(file.createdAt)}
          </Text>
        </Stack>
        <ItemMenu label={file.name} {...actions}>
          <Menu.Item leftSection={<IconEye size={14} />} onClick={onPreview}>
            Aperçu
          </Menu.Item>
          <Menu.Item leftSection={<IconDownload size={14} />} onClick={onDownload}>
            Télécharger
          </Menu.Item>
          <Menu.Divider />
        </ItemMenu>
      </Group>
    </Card>
  );
}
