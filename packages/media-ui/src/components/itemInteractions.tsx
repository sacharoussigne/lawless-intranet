'use client';

import {
  createContext,
  useContext,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
  type ReactNode,
} from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ActionIcon, Box, Menu, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconDotsVertical, IconFileTypePdf, IconLink, IconPhoto } from '@tabler/icons-react';
import { canDrop, dragId, dropId, type DragItem } from '../dnd';
import { fileDropFolderProps } from '../fileDrop';
import { getFileKind } from '../format';

/** Shared by grid tiles and list rows: same selection, opening, menus and drag & drop. */

export type SelectModifiers = { toggle: boolean; range: boolean };

export type LongPressPoint = { x: number; y: number };

/**
 * Drive-like interactions: click selects (Ctrl toggles, Shift selects a range),
 * double-click / Enter opens, right-click opens the menu.
 */
export type ItemInteractions = {
  selected: boolean;
  /** Touch screens: a single tap opens (double-tap is unreliable). */
  openOnClick: boolean;
  /** Touch selection mode: a tap checks / unchecks the item (and shows a checkbox). */
  toggleOnClick: boolean;
  /** Touch: press and hold opens the item menu at the finger (iOS has no right-click). */
  onLongPress: (point: LongPressPoint) => void;
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
  if (interactions.toggleOnClick && !modifiers.range) {
    interactions.onSelect({ toggle: true, range: false });
  } else if (!modifiers.toggle && !modifiers.range && (interactions.openOnClick || event.detail === 0)) {
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

const LONG_PRESS_MS = 450;
const LONG_PRESS_TOLERANCE_PX = 10;

/**
 * Touch press-and-hold on an item (iOS has no right-click). The touch end and the
 * click that end the press are swallowed, so they neither open the item nor close
 * a menu opened by the press.
 */
export function useLongPress(onLongPress: (point: LongPressPoint) => void) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };

  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      const point = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        // A selection iOS may have started before the menu opens.
        window.getSelection()?.removeAllRanges();
        navigator.vibrate?.(10);
        onLongPress(point);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: PointerEvent) => {
      const start = origin.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_TOLERANCE_PX) {
        cancel();
      }
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // No compatibility mousedown / click after the press (they would close the menu at once).
    onTouchEnd: (event: TouchEvent) => {
      if (fired.current) event.preventDefault();
    },
    onClickCapture: (event: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

export function KebabMenu({ label, children }: { label: string; children: ReactNode }) {
  // Touch: thumb-sized target.
  const touch = useMediaQuery('(hover: none)') ?? false;
  return (
    <Box onClick={stopPropagation} onDoubleClick={stopPropagation} style={{ pointerEvents: 'auto' }}>
      <Menu position="bottom-end" width={230} shadow="md" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="slate"
            radius="xl"
            size={touch ? 'xl' : 'md'}
            aria-label={`Actions pour ${label}`}
          >
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
