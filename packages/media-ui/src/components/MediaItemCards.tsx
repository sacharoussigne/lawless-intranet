'use client';

import Link from 'next/link';
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { ActionIcon, Box, Card, Center, Group, Image, Menu, Text } from '@mantine/core';
import { IconDotsVertical, IconFileTypePdf, IconFolderFilled, IconPhoto } from '@tabler/icons-react';
import type { MediaFileRecord, MediaFolderRecord } from '@lawless-intranet/types';
import { canDrop, dragId, dropId, type DragItem } from '../dnd';
import { formatBytes, getFileKind } from '../format';
import { useMediaUi } from '../MediaUiProvider';

const THUMB_HEIGHT = 150;

/** Drive-like interactions: click selects, double-click / Enter opens, right-click opens the menu. */
export type TileInteractions = {
  selected: boolean;
  /** Touch screens: a single tap opens (double-tap is unreliable). */
  openOnClick: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDeleteKey: () => void;
  onContextMenu: (event: MouseEvent) => void;
  /** Entries of the ⋮ menu (same as the right-click menu). */
  menu: ReactNode;
  /** Position of the item, used to drag it into another folder. */
  dragItem: DragItem;
};

function tileStyle(highlighted: boolean, dragging: boolean): CSSProperties {
  return {
    position: 'relative',
    cursor: 'default',
    userSelect: 'none',
    opacity: dragging ? 0.4 : 1,
    backgroundColor: highlighted ? 'var(--mantine-primary-color-light)' : 'var(--mantine-color-default-hover)',
    borderColor: highlighted ? 'var(--mantine-primary-color-filled)' : 'transparent',
  };
}

/** The dragged item, when it may be dropped into `folderId`. */
export function useDropHighlight(folderId: string | null) {
  const droppable = useDroppable({ id: dropId(folderId) });
  const { active } = useDndContext();
  const item = active?.data.current as DragItem | undefined;
  return {
    setNodeRef: droppable.setNodeRef,
    highlighted: droppable.isOver && item !== undefined && canDrop(item, folderId),
  };
}

const stop = (event: MouseEvent) => event.stopPropagation();

function KebabMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box onClick={stop} onDoubleClick={stop} style={{ pointerEvents: 'auto' }}>
      <Menu position="bottom-end" width={230} shadow="md" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="slate" radius="xl" aria-label={`Actions pour ${label}`}>
            <IconDotsVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>{children}</Menu.Dropdown>
      </Menu>
    </Box>
  );
}

function handleTileClick(event: MouseEvent, interactions: TileInteractions) {
  // `detail === 0`: click synthesized by the keyboard (Enter on a link).
  if (interactions.openOnClick || event.detail === 0) interactions.onOpen();
  else interactions.onSelect();
}

function handleTileKeyDown(event: KeyboardEvent, interactions: TileInteractions, enterOpens: boolean) {
  if (event.key === 'Delete') {
    event.preventDefault();
    interactions.onDeleteKey();
  } else if (enterOpens && event.key === 'Enter') {
    event.preventDefault();
    interactions.onOpen();
  }
}

export function FolderCard({
  folder,
  href,
  ...interactions
}: TileInteractions & { folder: MediaFolderRecord; href: string }) {
  const draggable = useDraggable({ id: dragId(interactions.dragItem), data: interactions.dragItem });
  const drop = useDropHighlight(folder.id);

  return (
    <Card
      ref={(node: HTMLDivElement | null) => {
        draggable.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...draggable.listeners}
      withBorder
      radius="lg"
      padding="xs"
      pl="md"
      style={tileStyle(interactions.selected || drop.highlighted, draggable.isDragging)}
      onClick={stop}
      onContextMenu={interactions.onContextMenu}
    >
      {/* Stretched real link: middle-click / Ctrl+click open a new tab. */}
      <Link
        href={href}
        aria-label={folder.name}
        draggable={false}
        style={{ position: 'absolute', inset: 0, borderRadius: 'inherit' }}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          handleTileClick(event, interactions);
        }}
        onDoubleClick={interactions.onOpen}
        onKeyDown={(event) => handleTileKeyDown(event, interactions, false)}
      />
      <Group gap="sm" wrap="nowrap" style={{ position: 'relative', pointerEvents: 'none' }}>
        <IconFolderFilled size={22} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        <Text size="sm" fw={500} truncate="end" style={{ flex: 1, minWidth: 0 }} title={folder.name}>
          {folder.name}
        </Text>
        <KebabMenu label={folder.name}>{interactions.menu}</KebabMenu>
      </Group>
    </Card>
  );
}

export function FileCard({ file, ...interactions }: TileInteractions & { file: MediaFileRecord }) {
  const { formatDate } = useMediaUi();
  const kind = getFileKind(file.mimeType);
  const TypeIcon = kind === 'pdf' ? IconFileTypePdf : IconPhoto;
  const typeColor = kind === 'pdf' ? 'var(--mantine-color-danger-6)' : 'var(--mantine-primary-color-filled)';
  const draggable = useDraggable({ id: dragId(interactions.dragItem), data: interactions.dragItem });

  return (
    <Card
      ref={draggable.setNodeRef}
      {...draggable.listeners}
      withBorder
      radius="lg"
      padding="xs"
      tabIndex={0}
      role="button"
      aria-label={file.name}
      aria-pressed={interactions.selected}
      title={`${file.name}\n${formatBytes(file.size)} · ${formatDate(file.createdAt)}`}
      style={tileStyle(interactions.selected, draggable.isDragging)}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        handleTileClick(event, interactions);
      }}
      onDoubleClick={interactions.onOpen}
      onKeyDown={(event: KeyboardEvent) => handleTileKeyDown(event, interactions, true)}
      onContextMenu={interactions.onContextMenu}
    >
      <Group gap="sm" wrap="nowrap" pl={6} mb="xs">
        <TypeIcon size={18} color={typeColor} style={{ flexShrink: 0 }} />
        <Text size="sm" fw={500} truncate="end" style={{ flex: 1, minWidth: 0 }}>
          {file.name}
        </Text>
        <KebabMenu label={file.name}>{interactions.menu}</KebabMenu>
      </Group>
      <Box
        h={THUMB_HEIGHT}
        style={{ borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}
        bg="var(--mantine-color-body)"
      >
        {kind === 'image' && file.previewUrl ? (
          <Image src={file.previewUrl} alt={file.name} h="100%" w="100%" fit="cover" loading="lazy" draggable={false} />
        ) : (
          <Center h="100%">
            <TypeIcon size={56} stroke={1.25} color={typeColor} />
          </Center>
        )}
      </Box>
    </Card>
  );
}

/** Label following the cursor while dragging. */
export function DragChip({ name, kind }: { name: string; kind: DragItem['kind'] }) {
  return (
    <Card withBorder shadow="md" radius="lg" padding="xs" px="md" maw={260} style={{ cursor: 'grabbing' }}>
      <Group gap="sm" wrap="nowrap">
        {kind === 'folder' ? (
          <IconFolderFilled size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        ) : (
          <IconPhoto size={18} color="var(--mantine-primary-color-filled)" style={{ flexShrink: 0 }} />
        )}
        <Text size="sm" fw={500} truncate="end">
          {name}
        </Text>
      </Group>
    </Card>
  );
}
