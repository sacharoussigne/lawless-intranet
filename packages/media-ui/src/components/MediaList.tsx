'use client';

import Link from 'next/link';
import { type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Group, Table, Text, UnstyledButton } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconFolderFilled } from '@tabler/icons-react';
import type { MediaFileRecord, MediaFolderRecord } from '@lawless-intranet/types';
import { formatBytes, type MediaSort, type MediaSortKey } from '../format';
import { useMediaUi } from '../MediaUiProvider';
import { itemKey } from '../selection';
import {
  fileTypeIcon,
  handleEnterKey,
  handleFolderLinkClick,
  handleItemClick,
  KebabMenu,
  SELECTION_KEY_ATTRIBUTE,
  SharedBadge,
  stopPropagation,
  useItemDrag,
  type ItemInteractions,
} from './itemInteractions';

export type MediaListRow =
  | { kind: 'folder'; item: MediaFolderRecord; href: string; interactions: ItemInteractions }
  | { kind: 'file'; item: MediaFileRecord; interactions: ItemInteractions };

function rowStyle(highlighted: boolean, dragging: boolean): CSSProperties {
  return {
    cursor: 'default',
    userSelect: 'none',
    opacity: dragging ? 0.4 : 1,
    backgroundColor: highlighted ? 'var(--mantine-primary-color-light)' : undefined,
  };
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSortChange,
}: {
  label: string;
  sortKey: MediaSortKey;
  sort: MediaSort;
  onSortChange: (key: MediaSortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Arrow = sort.direction === 'asc' ? IconArrowUp : IconArrowDown;
  return (
    <UnstyledButton onClick={() => onSortChange(sortKey)} aria-label={`Trier par ${label.toLowerCase()}`}>
      <Group gap={4} wrap="nowrap">
        <Text size="sm" fw={active ? 600 : 500}>
          {label}
        </Text>
        {active ? <Arrow size={14} /> : null}
      </Group>
    </UnstyledButton>
  );
}

/** Row shell: selection, opening, right-click and drag & drop like the grid tiles. */
function ItemRow({
  rowKey,
  interactions,
  focusable,
  children,
}: {
  rowKey: string;
  interactions: ItemInteractions;
  focusable: boolean;
  children: ReactNode;
}) {
  const drag = useItemDrag(interactions.dragItem);
  return (
    <Table.Tr
      ref={drag.setNodeRef}
      {...drag.listeners}
      {...{ [SELECTION_KEY_ATTRIBUTE]: rowKey }}
      tabIndex={focusable ? 0 : undefined}
      aria-selected={interactions.selected}
      style={rowStyle(interactions.selected || drag.dropHighlighted, drag.isDragged)}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        handleItemClick(event, interactions);
      }}
      onDoubleClick={interactions.onOpen}
      onKeyDown={focusable ? (event: KeyboardEvent) => handleEnterKey(event, interactions) : undefined}
      onContextMenu={interactions.onContextMenu}
    >
      {children}
    </Table.Tr>
  );
}

function FolderRow({ row }: { row: Extract<MediaListRow, { kind: 'folder' }> }) {
  const { formatDate } = useMediaUi();
  return (
    <ItemRow rowKey={itemKey('folder', row.item.id)} interactions={row.interactions} focusable={false}>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <IconFolderFilled size={20} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
          {/* Real link for middle-click; Ctrl / Shift + click select, like Drive. */}
          <Text
            component={Link}
            href={row.href}
            draggable={false}
            size="sm"
            fw={500}
            truncate="end"
            c="inherit"
            style={{ textDecoration: 'none' }}
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              handleFolderLinkClick(event, row.interactions);
            }}
          >
            {row.item.name}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td visibleFrom="sm">
        <Text size="sm" c="dimmed">
          {formatDate(row.item.createdAt)}
        </Text>
      </Table.Td>
      <Table.Td visibleFrom="sm">
        <Text size="sm" c="dimmed">
          —
        </Text>
      </Table.Td>
      <Table.Td w={48}>
        <KebabMenu label={row.item.name}>{row.interactions.menu}</KebabMenu>
      </Table.Td>
    </ItemRow>
  );
}

function FileRow({ row }: { row: Extract<MediaListRow, { kind: 'file' }> }) {
  const { formatDate } = useMediaUi();
  const { Icon, color } = fileTypeIcon(row.item.mimeType);
  return (
    <ItemRow rowKey={itemKey('file', row.item.id)} interactions={row.interactions} focusable>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Icon size={20} color={color} style={{ flexShrink: 0 }} />
          <Text size="sm" fw={500} truncate="end" title={row.item.name}>
            {row.item.name}
          </Text>
          {row.item.shareToken ? <SharedBadge /> : null}
        </Group>
      </Table.Td>
      <Table.Td visibleFrom="sm">
        <Text size="sm" c="dimmed">
          {formatDate(row.item.createdAt)}
        </Text>
      </Table.Td>
      <Table.Td visibleFrom="sm">
        <Text size="sm" c="dimmed">
          {formatBytes(row.item.size)}
        </Text>
      </Table.Td>
      <Table.Td w={48}>
        <KebabMenu label={row.item.name}>{row.interactions.menu}</KebabMenu>
      </Table.Td>
    </ItemRow>
  );
}

/** Drive-like list view: folders then files, sortable by clicking the headers. */
export function MediaList({
  rows,
  sort,
  onSortChange,
}: {
  rows: readonly MediaListRow[];
  sort: MediaSort;
  onSortChange: (key: MediaSortKey) => void;
}) {
  return (
    <Table verticalSpacing={6} style={{ tableLayout: 'fixed' }}>
      {/* Header clicks sort: they must not start a rectangle selection or clear the selection. */}
      <Table.Thead onMouseDown={stopPropagation} onClick={stopPropagation}>
        <Table.Tr>
          <Table.Th>
            <SortHeader label="Nom" sortKey="name" sort={sort} onSortChange={onSortChange} />
          </Table.Th>
          <Table.Th w={170} visibleFrom="sm">
            <SortHeader label="Date d'ajout" sortKey="date" sort={sort} onSortChange={onSortChange} />
          </Table.Th>
          <Table.Th w={110} visibleFrom="sm">
            <Text size="sm" fw={500}>
              Taille
            </Text>
          </Table.Th>
          <Table.Th w={48} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) =>
          row.kind === 'folder' ? (
            <FolderRow key={itemKey('folder', row.item.id)} row={row} />
          ) : (
            <FileRow key={itemKey('file', row.item.id)} row={row} />
          ),
        )}
      </Table.Tbody>
    </Table>
  );
}
