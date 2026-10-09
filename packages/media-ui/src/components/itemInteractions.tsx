'use client';

import { createContext, useContext, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ActionIcon, Box, Menu, Tooltip } from '@mantine/core';
import { IconDotsVertical, IconFileTypePdf, IconLink, IconPhoto } from '@tabler/icons-react';
import { canDrop, dragId, dropId, type DragItem } from '../dnd';
import { fileDropFolderProps } from '../fileDrop';
import { getFileKind } from '../format';

/** Shared by grid tiles and list rows: same selection, opening, menus and drag & drop. */

export type SelectModifiers = { toggle: boolean; range: boolean };

/**
 * Drive-like interactions: click selects (Ctrl toggles, Shift selects a range),
 * double-click / Enter opens, right-click opens the menu.
 */
export type ItemInteractions = {
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

/** Marks items for the rectangle selection (see MediaLibrary). */
export const SELECTION_KEY_ATTRIBUTE = 'data-media-key';

/** Items being dragged (the whole selection when a selected item is dragged). */
export const DraggedItemsContext = createContext<readonly DragItem[]>([]);

/** Folder hovered by files dragged from the computer (null = root, undefined = none). */
export const FileDropTargetContext = createContext<string | null | undefined>(undefined);

/**
 * Highlights `folderId` while hovered by a drag that may be dropped there:
 * items moved in the app, or files from the computer (spread `fileDropProps`).
 */
export function useDropHighlight(folderId: string | null, disabled = false) {
  const droppable = useDroppable({ id: disabled ? `nodrop:${folderId}` : dropId(folderId), disabled });
  const dragged = useContext(DraggedItemsContext);
  const fileTarget = useContext(FileDropTargetContext);
  return {
    setNodeRef: droppable.setNodeRef,
    highlighted:
      !disabled && ((droppable.isOver && canDrop(dragged, folderId)) || (fileTarget !== undefined && fileTarget === folderId)),
    fileDropProps: disabled ? {} : fileDropFolderProps(folderId),
  };
}

/** Draggable item; folders are also drop targets. */
export function useItemDrag(item: DragItem) {
  const draggable = useDraggable({ id: dragId(item), data: item });
  const drop = useDropHighlight(item.id, item.kind !== 'folder');
  const dragged = useContext(DraggedItemsContext);
  return {
    setNodeRef: (node: HTMLElement | null) => {
      draggable.setNodeRef(node);
      drop.setNodeRef(node);
    },
    listeners: draggable.listeners,
    isDragged: dragged.some((entry) => entry.kind === item.kind && entry.id === item.id),
    dropHighlighted: drop.highlighted,
    fileDropProps: drop.fileDropProps,
  };
}

export const stopPropagation = (event: MouseEvent) => event.stopPropagation();

export function handleItemClick(event: MouseEvent, interactions: ItemInteractions) {
  const modifiers = { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey };
  // `detail === 0`: click synthesized by the keyboard (Enter on a link).
  if (!modifiers.toggle && !modifiers.range && (interactions.openOnClick || event.detail === 0)) {
    interactions.onOpen();
  } else {
    interactions.onSelect(modifiers);
  }
}

/**
 * Click on a folder's real link: plain / Ctrl / Shift clicks are handled like
 * any item; middle-click (no click event) and Alt+click keep the browser behaviour.
 */
export function handleFolderLinkClick(event: MouseEvent, interactions: ItemInteractions) {
  if (event.button !== 0 || event.altKey) return;
  event.preventDefault();
  handleItemClick(event, interactions);
}

export function handleEnterKey(event: KeyboardEvent, interactions: ItemInteractions) {
  if (event.key === 'Enter') {
    event.preventDefault();
    interactions.onOpen();
  }
}

export function KebabMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box onClick={stopPropagation} onDoubleClick={stopPropagation} style={{ pointerEvents: 'auto' }}>
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

export function fileTypeIcon(mimeType: string) {
  const kind = getFileKind(mimeType);
  return kind === 'pdf'
    ? { kind, Icon: IconFileTypePdf, color: 'var(--mantine-color-danger-6)' }
    : { kind, Icon: IconPhoto, color: 'var(--mantine-primary-color-filled)' };
}

export function SharedBadge() {
  return (
    <Tooltip label="Partagé par lien" withinPortal>
      <IconLink size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} aria-label="Partagé par lien" />
    </Tooltip>
  );
}
