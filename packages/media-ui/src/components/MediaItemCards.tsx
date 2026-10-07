'use client';

import Link from 'next/link';
import {
  createContext,
  useContext,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ActionIcon, Box, Card, Center, Group, Image, Menu, Text, Tooltip } from '@mantine/core';
import {
  IconDotsVertical,
  IconFileTypePdf,
  IconFiles,
  IconFolderFilled,
  IconLink,
  IconPhoto,
} from '@tabler/icons-react';
import type { MediaFileRecord, MediaFolderRecord } from '@lawless-intranet/types';
import { canDrop, dragId, dropId, type DragItem } from '../dnd';
import { formatBytes, getFileKind } from '../format';
import { useMediaUi } from '../MediaUiProvider';
import { itemKey } from '../selection';

const THUMB_HEIGHT = 150;

export type SelectModifiers = { toggle: boolean; range: boolean };

/**
 * Drive-like interactions: click selects (Ctrl toggles, Shift selects a range),
 * double-click / Enter opens, right-click opens the menu.
 */
export type TileInteractions = {
  selected: boolean;
  /** Touch screens: a single tap opens (double-tap is unreliable). */
  openOnClick: boolean;
  onSelect: (modifiers: SelectModifiers) => void;
  onOpen: () => void;
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

/** Items being dragged (the whole selection when a selected item is dragged). */
export const DraggedItemsContext = createContext<readonly DragItem[]>([]);

function useIsDragged(item: DragItem): boolean {
  const dragged = useContext(DraggedItemsContext);
  return dragged.some((entry) => entry.kind === item.kind && entry.id === item.id);
}

/** Highlights `folderId` while hovered by a drag that may be dropped there. */
export function useDropHighlight(folderId: string | null) {
  const droppable = useDroppable({ id: dropId(folderId) });
  const dragged = useContext(DraggedItemsContext);
  return {
    setNodeRef: droppable.setNodeRef,
    highlighted: droppable.isOver && canDrop(dragged, folderId),
  };
}

/** Marks tiles for the rectangle selection (see MediaLibrary). */
export const SELECTION_KEY_ATTRIBUTE = 'data-media-key';

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
  const modifiers = { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey };
  // `detail === 0`: click synthesized by the keyboard (Enter on a link).
  if (!modifiers.toggle && !modifiers.range && (interactions.openOnClick || event.detail === 0)) {
    interactions.onOpen();
  } else {
    interactions.onSelect(modifiers);
  }
}

function handleEnterKey(event: KeyboardEvent, interactions: TileInteractions) {
  if (event.key === 'Enter') {
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
  const isDragged = useIsDragged(interactions.dragItem);

  return (
    <Card
      ref={(node: HTMLDivElement | null) => {
        draggable.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...draggable.listeners}
      {...{ [SELECTION_KEY_ATTRIBUTE]: itemKey('folder', folder.id) }}
      withBorder
      radius="lg"
      padding="xs"
      pl="md"
      style={tileStyle(interactions.selected || drop.highlighted, isDragged)}
      onClick={stop}
      onContextMenu={interactions.onContextMenu}
    >
      {/* Stretched real link: middle-click opens a new tab; Ctrl / Shift + click select, like Drive. */}
      <Link
        href={href}
        aria-label={folder.name}
        draggable={false}
        style={{ position: 'absolute', inset: 0, borderRadius: 'inherit' }}
        onClick={(event) => {
          if (event.button !== 0 || event.altKey) return;
          event.preventDefault();
          handleTileClick(event, interactions);
        }}
        onDoubleClick={interactions.onOpen}
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
  const isDragged = useIsDragged(interactions.dragItem);

  return (
    <Card
      ref={draggable.setNodeRef}
      {...draggable.listeners}
      {...{ [SELECTION_KEY_ATTRIBUTE]: itemKey('file', file.id) }}
      withBorder
      radius="lg"
      padding="xs"
      tabIndex={0}
      role="button"
      aria-label={file.name}
      aria-pressed={interactions.selected}
      title={`${file.name}\n${formatBytes(file.size)} · ${formatDate(file.createdAt)}`}
      style={tileStyle(interactions.selected, isDragged)}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        handleTileClick(event, interactions);
      }}
      onDoubleClick={interactions.onOpen}
      onKeyDown={(event: KeyboardEvent) => handleEnterKey(event, interactions)}
      onContextMenu={interactions.onContextMenu}
    >
      <Group gap="sm" wrap="nowrap" pl={6} mb="xs">
        <TypeIcon size={18} color={typeColor} style={{ flexShrink: 0 }} />
        <Text size="sm" fw={500} truncate="end" style={{ flex: 1, minWidth: 0 }}>
          {file.name}
        </Text>
        {file.shareToken ? (
          <Tooltip label="Partagé par lien" withinPortal>
            <IconLink size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} aria-label="Partagé par lien" />
          </Tooltip>
        ) : null}
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
export function DragChip({ items, name }: { items: readonly DragItem[]; name: string }) {
  const [first] = items;
  const kind = items.length > 1 ? 'many' : first?.kind;
  return (
    <Card withBorder shadow="md" radius="lg" padding="xs" px="md" maw={260} style={{ cursor: 'grabbing' }}>
      <Group gap="sm" wrap="nowrap">
        {kind === 'many' ? (
          <IconFiles size={18} color="var(--mantine-primary-color-filled)" style={{ flexShrink: 0 }} />
        ) : kind === 'folder' ? (
          <IconFolderFilled size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        ) : (
          <IconPhoto size={18} color="var(--mantine-primary-color-filled)" style={{ flexShrink: 0 }} />
        )}
        <Text size="sm" fw={500} truncate="end">
          {items.length > 1 ? `${items.length} éléments` : name}
        </Text>
      </Group>
    </Card>
  );
}
