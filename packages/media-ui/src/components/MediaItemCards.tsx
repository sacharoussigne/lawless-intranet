'use client';

import Link from 'next/link';
import { useContext, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { Box, Card, Center, Checkbox, Group, Image, Text, Tooltip } from '@mantine/core';
import { IconFiles, IconFolderFilled, IconPhoto } from '@tabler/icons-react';
import type { MediaFileRecord, MediaFolderRecord } from '@lawless-intranet/types';
import { type DragItem } from '../dnd';
import { formatBytes } from '../format';
import { useMediaUi } from '../MediaUiProvider';
import { itemKey } from '../selection';
import {
  DraggedItemsContext,
  fileTypeIcon,
  handleEnterKey,
  handleFolderLinkClick,
  handleItemClick,
  KebabMenu,
  SELECTION_KEY_ATTRIBUTE,
  SharedBadge,
  stopPropagation,
  useItemDrag,
  useLongPress,
  type ItemInteractions,
} from './itemInteractions';

const THUMB_HEIGHT = 150;

/** Touch selection mode: check mark in the tile's corner. */
function SelectionCheck({ checked }: { checked: boolean }) {
  return (
    <Checkbox
      checked={checked}
      readOnly
      tabIndex={-1}
      aria-hidden
      radius="xl"
      size="md"
      style={{ pointerEvents: 'none', flexShrink: 0 }}
    />
  );
}

function tileStyle(highlighted: boolean, dragging: boolean): CSSProperties {
  return {
    position: 'relative',
    cursor: 'default',
    userSelect: 'none',
    // Safari only knows the prefixed property.
    WebkitUserSelect: 'none',
    // iOS: no link / image callout on press-and-hold (that gesture opens the menu).
    WebkitTouchCallout: 'none',
    opacity: dragging ? 0.4 : 1,
    backgroundColor: highlighted ? 'var(--mantine-primary-color-light)' : 'var(--mantine-color-default-hover)',
    borderColor: highlighted ? 'var(--mantine-primary-color-filled)' : 'transparent',
  };
}

export function FolderCard({
  folder,
  href,
  ...interactions
}: ItemInteractions & { folder: MediaFolderRecord; href: string }) {
  const drag = useItemDrag(interactions.dragItem);
  const longPress = useLongPress(interactions.onLongPress);

  return (
    <Card
      ref={drag.setNodeRef}
      {...drag.listeners}
      {...drag.fileDropProps}
      {...longPress}
      {...{ [SELECTION_KEY_ATTRIBUTE]: itemKey('folder', folder.id) }}
      withBorder
      radius="lg"
      padding="xs"
      pl="md"
      style={tileStyle(interactions.selected || drag.dropHighlighted, drag.isDragged)}
      onClick={stopPropagation}
      onContextMenu={interactions.onContextMenu}
    >
      {/* Stretched real link: middle-click opens a new tab; Ctrl / Shift + click select, like Drive. */}
      <Link
        href={href}
        aria-label={folder.name}
        draggable={false}
        style={{ position: 'absolute', inset: 0, borderRadius: 'inherit' }}
        onClick={(event) => handleFolderLinkClick(event, interactions)}
        onDoubleClick={interactions.onOpen}
      />
      <Group gap="sm" wrap="nowrap" style={{ position: 'relative', pointerEvents: 'none' }}>
        {interactions.toggleOnClick ? <SelectionCheck checked={interactions.selected} /> : null}
        <IconFolderFilled size={22} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        <Text size="sm" fw={500} truncate="end" style={{ flex: 1, minWidth: 0 }} title={folder.name}>
          {folder.name}
        </Text>
        <KebabMenu label={folder.name}>{interactions.menu}</KebabMenu>
      </Group>
    </Card>
  );
}

export function FileCard({ file, ...interactions }: ItemInteractions & { file: MediaFileRecord }) {
  const { formatDate } = useMediaUi();
  const { kind, Icon: TypeIcon, color: typeColor } = fileTypeIcon(file.mimeType);
  const drag = useItemDrag(interactions.dragItem);
  const longPress = useLongPress(interactions.onLongPress);
  const dragging = useContext(DraggedItemsContext).length > 0;
  // Touch: a tap opens or toggles, a tooltip would only get in the way.
  const touch = interactions.openOnClick || interactions.toggleOnClick;

  return (
    <Card
      ref={drag.setNodeRef}
      {...drag.listeners}
      {...longPress}
      {...{ [SELECTION_KEY_ATTRIBUTE]: itemKey('file', file.id) }}
      withBorder
      radius="lg"
      padding="xs"
      tabIndex={0}
      role="button"
      aria-label={file.name}
      aria-pressed={interactions.selected}
      style={tileStyle(interactions.selected, drag.isDragged)}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        handleItemClick(event, interactions);
      }}
      onDoubleClick={interactions.onOpen}
      onKeyDown={(event: KeyboardEvent) => handleEnterKey(event, interactions)}
      onContextMenu={interactions.onContextMenu}
    >
      <Group gap="sm" wrap="nowrap" pl={6} mb="xs">
        {interactions.toggleOnClick ? <SelectionCheck checked={interactions.selected} /> : null}
        <TypeIcon size={18} color={typeColor} style={{ flexShrink: 0 }} />
        <Text size="sm" fw={500} truncate="end" style={{ flex: 1, minWidth: 0 }}>
          {file.name}
        </Text>
        {file.shareToken ? <SharedBadge /> : null}
        <KebabMenu label={file.name}>{interactions.menu}</KebabMenu>
      </Group>
      {/* Full name over the thumbnail (the title above it is truncated); none while dragging items. */}
      <Tooltip
        label={
          <>
            <Text size="sm" fw={500} style={{ wordBreak: 'break-word' }}>
              {file.name}
            </Text>
            <Text size="xs" opacity={0.75}>
              {formatBytes(file.size)} · {formatDate(file.createdAt)}
            </Text>
          </>
        }
        multiline
        maw={320}
        position="bottom"
        openDelay={300}
        disabled={dragging || touch}
        withinPortal
      >
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
      </Tooltip>
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
