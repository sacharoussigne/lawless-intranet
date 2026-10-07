'use client';

import { useCallback, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Anchor,
  Box,
  Breadcrumbs,
  Center,
  Group,
  Loader,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useLocalStorage, useMediaQuery, useWindowEvent } from '@mantine/hooks';
import { IconAlertTriangle, IconChevronDown, IconUpload } from '@tabler/icons-react';
import type {
  MediaFileRecord,
  MediaFolderContentsRecord,
  MediaFolderRecord,
} from '@lawless-intranet/types';
import { ContextMenu, useContextMenu } from './components/ContextMenu';
import { DeleteModal } from './components/DeleteModal';
import {
  DraggedItemsContext,
  SELECTION_KEY_ATTRIBUTE,
  useDropHighlight,
  type ItemInteractions,
  type SelectModifiers,
} from './components/itemInteractions';
import { DragChip, FileCard, FolderCard } from './components/MediaItemCards';
import { MediaList, type MediaListRow } from './components/MediaList';
import {
  BackgroundMenuItems,
  FileMenuItems,
  FolderMenuItems,
  SelectionMenuItems,
} from './components/MediaMenus';
import { MoveModal } from './components/MoveModal';
import { NameModal } from './components/NameModal';
import { MediaViewer } from './components/MediaViewer';
import { SelectionBar } from './components/SelectionBar';
import { SortControl, ViewToggle, type MediaView } from './components/ViewControls';
import { UploadQueue } from './components/UploadQueue';
import {
  useInvalidateMedia,
  useMediaDownload,
  useMediaFolderContents,
  useMediaMutations,
  useMediaShare,
} from './hooks/useMediaQueries';
import { useMediaRealtime } from './hooks/useMediaRealtime';
import { useMediaUploads } from './hooks/useMediaUploads';
import { useMediaUi } from './MediaUiProvider';
import { canDrop, parseDropId, type DragItem } from './dnd';
import { DEFAULT_MEDIA_SORT, nextSort, parseMediaSort, sortItems, type MediaSort } from './format';
import {
  applyClick,
  EMPTY_SELECTION,
  itemKey,
  pruneSelection,
  rectFromPoints,
  rectsIntersect,
  selectOnly,
  splitSelection,
  type Rect,
  type Selection,
} from './selection';

export const MEDIA_FOLDER_PARAM = 'folder';

/** Same columns for folders and files so both grids line up, like Drive. */
const GRID_COLS = { base: 1, xs: 2, sm: 3, md: 4, xl: 5 };
/** Per-browser display preferences (fall back to defaults when storage is unavailable). */
const SORT_STORAGE_KEY = 'lawless-media:sort';
const VIEW_STORAGE_KEY = 'lawless-media:view';

function readJson(value: string | undefined): unknown {
  try {
    return value ? (JSON.parse(value) as unknown) : null;
  } catch {
    return null;
  }
}

/** Pointer travel before a background press becomes a rectangle selection. */
const LASSO_THRESHOLD_PX = 4;

type Target =
  | { kind: 'folder'; item: MediaFolderRecord }
  | { kind: 'file'; item: MediaFileRecord };

type Dialog =
  | { type: 'create' }
  | { type: 'rename'; target: Target }
  | { type: 'move'; keys: string[] }
  | { type: 'delete'; keys: string[] }
  | null;

type LassoGesture = {
  origin: { x: number; y: number };
  /** Selection when the gesture started (kept with Ctrl). */
  base: ReadonlySet<string>;
  additive: boolean;
  moved: boolean;
};

function toDragItem(target: Target): DragItem {
  return {
    kind: target.kind,
    id: target.item.id,
    parentId: target.kind === 'folder' ? target.item.parentId : target.item.folderId,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

/** Breadcrumb link that also accepts dropped items (move up to a parent or the root). */
function DropCrumb({ folderId, href, label }: { folderId: string | null; href: string; label: string }) {
  const drop = useDropHighlight(folderId);
  return (
    <Anchor
      ref={drop.setNodeRef}
      component={Link}
      href={href}
      size="lg"
      c={drop.highlighted ? undefined : 'dimmed'}
      px="xs"
      py={4}
      style={{
        borderRadius: 'var(--mantine-radius-xl)',
        backgroundColor: drop.highlighted ? 'var(--mantine-primary-color-light)' : undefined,
      }}
    >
      {label}
    </Anchor>
  );
}

export type MediaLibraryProps = {
  /** Contents loaded by the server component for `initialFolderId`. */
  initialContents?: MediaFolderContentsRecord;
  initialFolderId?: string | null;
};

/**
 * Drive-like library: right-click menus, multiple selection (click, Ctrl, Shift,
 * Ctrl+A, rectangle), double-click to open, drag & drop (upload and move),
 * rename, move, delete, preview.
 */
export function MediaLibrary({ initialContents, initialFolderId = null }: MediaLibraryProps) {
  const { limits } = useMediaUi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const folderId = searchParams.get(MEDIA_FOLDER_PARAM);

  const contentsQuery = useMediaFolderContents(
    folderId,
    initialContents ? { folderId: initialFolderId, contents: initialContents } : undefined,
  );
  const mutations = useMediaMutations();
  const download = useMediaDownload();
  const share = useMediaShare();
  const uploads = useMediaUploads();
  useMediaRealtime();
  const contextMenu = useContextMenu();
  const invalidate = useInvalidateMedia();
  const openOnClick = useMediaQuery('(hover: none)') ?? false;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const lassoRef = useRef<LassoGesture | null>(null);
  const suppressClickRef = useRef(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectionState, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [lassoRect, setLassoRect] = useState<Rect | null>(null);
  const [dragged, setDragged] = useState<{ items: DragItem[]; name: string } | null>(null);
  const [sort, setSort] = useLocalStorage<MediaSort>({
    key: SORT_STORAGE_KEY,
    defaultValue: DEFAULT_MEDIA_SORT,
    serialize: JSON.stringify,
    deserialize: (value) => parseMediaSort(readJson(value)),
  });
  const [view, setView] = useLocalStorage<MediaView>({
    key: VIEW_STORAGE_KEY,
    defaultValue: 'grid',
    serialize: (value) => value,
    deserialize: (value) => (value === 'list' ? 'list' : 'grid'),
  });
  // Mouse only: on touch screens a drag would fight with scrolling, « Déplacer » covers it.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));

  const folderHref = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set(MEDIA_FOLDER_PARAM, id);
      else params.delete(MEDIA_FOLDER_PARAM);
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const contents = contentsQuery.data;
  const breadcrumb = contents?.breadcrumb ?? [];
  const currentFolderName = breadcrumb.at(-1)?.name ?? 'Médiathèque';

  /** Sorted folders then files (display, Shift ranges and viewer order) and lookup by selection key. */
  const { folders, files, order, targets } = useMemo(() => {
    const sortedFolders = sortItems(contents?.folders ?? [], sort);
    const sortedFiles = sortItems(contents?.files ?? [], sort);
    const entries: [string, Target][] = [
      ...sortedFolders.map((item): [string, Target] => [itemKey('folder', item.id), { kind: 'folder', item }]),
      ...sortedFiles.map((item): [string, Target] => [itemKey('file', item.id), { kind: 'file', item }]),
    ];
    return {
      folders: sortedFolders,
      files: sortedFiles,
      order: entries.map(([key]) => key),
      targets: new Map(entries),
    };
  }, [contents, sort]);

  // Items removed by someone else (realtime) or after a folder change drop out of the selection.
  const selection = pruneSelection(selectionState, order);
  const selectedKeys = order.filter((key) => selection.keys.has(key));
  // Derived from the live list: a deleted file closes the viewer, a refetch refreshes its URL.
  const previewIndex = previewId ? files.findIndex((file) => file.id === previewId) : -1;

  const closeDialog = () => setDialog(null);
  const clearSelection = () => setSelection(EMPTY_SELECTION);
  const nameOf = (keys: readonly string[]) => (keys[0] ? (targets.get(keys[0])?.item.name ?? '') : '');

  const handleRename = (target: Target, name: string) => {
    const mutation =
      target.kind === 'folder'
        ? mutations.updateFolder.mutateAsync({ id: target.item.id, name })
        : mutations.updateFile.mutateAsync({ id: target.item.id, name });
    void mutation.then(closeDialog, () => undefined);
  };

  const moveKeys = (keys: readonly string[], destinationId: string | null) =>
    mutations.moveItems.mutateAsync({ ...splitSelection(keys), destinationId, name: nameOf(keys) });

  const deleteKeys = (keys: readonly string[]) =>
    mutations.deleteItems.mutateAsync({ ...splitSelection(keys), name: nameOf(keys) }).then(() => clearSelection());

  // --- Keyboard: Ctrl+A, Escape, Delete (ignored in fields, dialogs, viewer and menus) ---
  useWindowEvent('keydown', (event) => {
    if (dialog || previewId || contextMenu.state || isEditableTarget(event.target)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setSelection({ keys: new Set(order), anchor: order[0] ?? null });
    } else if (event.key === 'Escape' && selection.keys.size > 0) {
      clearSelection();
    } else if (event.key === 'Delete' && selectedKeys.length > 0) {
      setDialog({ type: 'delete', keys: selectedKeys });
    }
  });

  // --- Rectangle selection, started by a press on the background ---
  const startLasso = (event: MouseEvent) => {
    if (event.button !== 0 || !(event.target instanceof HTMLElement)) return;
    // Portaled menus bubble through the React tree: only presses really on the surface count.
    if (!surfaceRef.current?.contains(event.target)) return;
    if (event.target.closest(`[${SELECTION_KEY_ATTRIBUTE}]`)) return;
    event.preventDefault(); // no text selection while drawing
    lassoRef.current = {
      origin: { x: event.clientX, y: event.clientY },
      base: selection.keys,
      additive: event.ctrlKey || event.metaKey,
      moved: false,
    };

    const onMove = (moveEvent: globalThis.MouseEvent) => {
      const gesture = lassoRef.current;
      if (!gesture) return;
      const point = { x: moveEvent.clientX, y: moveEvent.clientY };
      if (!gesture.moved && Math.hypot(point.x - gesture.origin.x, point.y - gesture.origin.y) < LASSO_THRESHOLD_PX) {
        return;
      }
      gesture.moved = true;
      const rect = rectFromPoints(gesture.origin, point);
      setLassoRect(rect);
      const hits: string[] = [];
      surfaceRef.current?.querySelectorAll<HTMLElement>(`[${SELECTION_KEY_ATTRIBUTE}]`).forEach((element) => {
        const key = element.getAttribute(SELECTION_KEY_ATTRIBUTE);
        if (key && rectsIntersect(rect, element.getBoundingClientRect())) hits.push(key);
      });
      setSelection({
        keys: new Set([...(gesture.additive ? gesture.base : []), ...hits]),
        anchor: hits[0] ?? null,
      });
    };

    const onUp = () => {
      // The click that follows a drawn rectangle must not clear the selection.
      suppressClickRef.current = lassoRef.current?.moved ?? false;
      lassoRef.current = null;
      setLassoRect(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // --- Drag & drop between folders (the whole selection when a selected item is dragged) ---
  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current as DragItem | undefined;
    if (!item) return;
    const key = itemKey(item.kind, item.id);
    const keys = selection.keys.has(key) ? selectedKeys : [key];
    if (!selection.keys.has(key)) setSelection(selectOnly(key));
    const items = keys.flatMap((entry) => {
      const target = targets.get(entry);
      return target ? [toDragItem(target)] : [];
    });
    setDragged({ items, name: nameOf(keys) });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const items = dragged?.items ?? [];
    setDragged(null);
    const destination = event.over ? parseDropId(String(event.over.id)) : undefined;
    if (destination === undefined || !canDrop(items, destination)) return;
    void moveKeys(
      items.map((item) => itemKey(item.kind, item.id)),
      destination,
    ).catch(() => undefined);
  };

  const startUpload = (picked: File[]) => {
    if (picked.length > 0) void uploads.upload(picked, folderId);
  };

  const backgroundMenu = (
    <BackgroundMenuItems
      onCreateFolder={() => setDialog({ type: 'create' })}
      onUpload={() => fileInputRef.current?.click()}
      uploadDisabled={!limits.storageConfigured}
    />
  );

  const itemActions = (key: string, target: Target) => ({
    onRename: () => setDialog({ type: 'rename', target }),
    onMove: () => setDialog({ type: 'move', keys: [key] }),
    onDelete: () => setDialog({ type: 'delete', keys: [key] }),
  });

  const tileInteractions = (key: string, target: Target, onOpen: () => void, menu: ReactNode): ItemInteractions => ({
    dragItem: toDragItem(target),
    selected: selection.keys.has(key),
    openOnClick,
    onSelect: (modifiers: SelectModifiers) => setSelection(applyClick(selection, key, modifiers, order)),
    onOpen,
    onContextMenu: (event: MouseEvent) => {
      if (selection.keys.has(key) && selection.keys.size > 1) {
        contextMenu.open(
          event,
          <SelectionMenuItems
            count={selectedKeys.length}
            onMove={() => setDialog({ type: 'move', keys: selectedKeys })}
            onDelete={() => setDialog({ type: 'delete', keys: selectedKeys })}
          />,
        );
        return;
      }
      setSelection(selectOnly(key));
      contextMenu.open(event, menu);
    },
    menu,
  });

  const folderRow = (folder: MediaFolderRecord): Extract<MediaListRow, { kind: 'folder' }> => {
    const key = itemKey('folder', folder.id);
    const target: Target = { kind: 'folder', item: folder };
    const href = folderHref(folder.id);
    const open = () => router.push(href);
    const menu = <FolderMenuItems onOpen={open} {...itemActions(key, target)} />;
    return { kind: 'folder', item: folder, href, interactions: tileInteractions(key, target, open, menu) };
  };

  const fileRow = (file: MediaFileRecord): Extract<MediaListRow, { kind: 'file' }> => {
    const key = itemKey('file', file.id);
    const target: Target = { kind: 'file', item: file };
    const open = () => setPreviewId(file.id);
    const menu = (
      <FileMenuItems
        onPreview={open}
        onDownload={() => void download(file.id)}
        share={
          share.enabled
            ? {
                shared: file.shareToken !== null,
                onCopyLink: () => share.copyLink(file),
                onRevokeLink: () => share.revoke(file),
              }
            : undefined
        }
        {...itemActions(key, target)}
      />
    );
    return { kind: 'file', item: file, interactions: tileInteractions(key, target, open, menu) };
  };

  const folderRows = folders.map(folderRow);
  const fileRows = files.map(fileRow);

  const dialogKeys = dialog?.type === 'move' || dialog?.type === 'delete' ? dialog.keys : [];
  const dialogTargets = dialogKeys.flatMap((key) => {
    const target = targets.get(key);
    return target ? [target] : [];
  });
  const isEmpty = contents && folders.length === 0 && files.length === 0;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragged(null)}
    >
      <DraggedItemsContext.Provider value={dragged?.items ?? []}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap" gap="sm" mih={36}>
            <Breadcrumbs separatorMargin={2}>
              {breadcrumb.length > 0 ? <DropCrumb folderId={null} href={folderHref(null)} label="Médiathèque" /> : null}
              {breadcrumb.slice(0, -1).map((crumb) => (
                <DropCrumb key={crumb.id} folderId={crumb.id} href={folderHref(crumb.id)} label={crumb.name} />
              ))}
              {/* Current folder: opens the same menu as a right-click on the background (Drive's « Mon Drive ▾ »). */}
              <Menu position="bottom-start" width={230} shadow="md" withinPortal>
                <Menu.Target>
                  <UnstyledButton px="xs" py={4} style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
                    <Group gap={4} wrap="nowrap">
                      <Text size="lg" fw={500}>
                        {currentFolderName}
                      </Text>
                      <IconChevronDown size={18} />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>{backgroundMenu}</Menu.Dropdown>
              </Menu>
            </Breadcrumbs>

            <Group gap="sm" wrap="nowrap">
              {selectedKeys.length > 0 ? (
                <SelectionBar
                  count={selectedKeys.length}
                  onClear={clearSelection}
                  onMove={() => setDialog({ type: 'move', keys: selectedKeys })}
                  onDelete={() => setDialog({ type: 'delete', keys: selectedKeys })}
                />
              ) : null}
              <ViewToggle value={view} onChange={setView} />
            </Group>
          </Group>

          {/* Grid only: the list view sorts from its column headers. */}
          {view === 'grid' && !isEmpty ? <SortControl sort={sort} onChange={setSort} /> : null}

          {!limits.storageConfigured ? (
            <Alert color="amber" icon={<IconAlertTriangle size={16} />}>
              Le stockage n&apos;est pas configuré : l&apos;import et l&apos;aperçu des fichiers sont indisponibles.
            </Alert>
          ) : null}

          {contentsQuery.isError && !contents ? (
            <Alert color="danger" icon={<IconAlertTriangle size={16} />}>
              {contentsQuery.error instanceof Error ? contentsQuery.error.message : 'Chargement impossible'}
            </Alert>
          ) : null}

          <Box
            ref={surfaceRef}
            onMouseDown={startLasso}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              clearSelection();
            }}
            onContextMenu={(event) => {
              clearSelection();
              contextMenu.open(event, backgroundMenu);
            }}
          >
            <Dropzone
              onDrop={startUpload}
              activateOnClick={false}
              // Mantine disables pointer events on the content by default: the cards need them (click, drag, menu).
              enablePointerEvents
              disabled={!limits.storageConfigured}
              multiple
              // Validation (type, size) is done by the upload queue for clear per-file errors.
              styles={{ root: { border: 0, padding: 0, background: 'transparent', cursor: 'default' } }}
            >
              <Stack gap="lg" mih="60vh">
                {!contents ? (
                  <Center py="xl">
                    <Loader />
                  </Center>
                ) : null}

                {view === 'list' && !isEmpty && contents ? (
                  <MediaList
                    rows={[...folderRows, ...fileRows]}
                    sort={sort}
                    onSortChange={(key) => setSort(nextSort(sort, key))}
                  />
                ) : null}

                {view === 'grid' && folderRows.length > 0 ? (
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>
                      Dossiers
                    </Text>
                    <SimpleGrid cols={GRID_COLS} spacing="sm">
                      {folderRows.map((row) => (
                        <FolderCard key={itemKey('folder', row.item.id)} folder={row.item} href={row.href} {...row.interactions} />
                      ))}
                    </SimpleGrid>
                  </Stack>
                ) : null}

                {view === 'grid' && fileRows.length > 0 ? (
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>
                      Fichiers
                    </Text>
                    <SimpleGrid cols={GRID_COLS} spacing="sm">
                      {fileRows.map((row) => (
                        <FileCard key={itemKey('file', row.item.id)} file={row.item} {...row.interactions} />
                      ))}
                    </SimpleGrid>
                  </Stack>
                ) : null}

                {isEmpty ? (
                  <Center py={80}>
                    <Stack gap={4} align="center">
                      <IconUpload size={40} stroke={1.25} color="var(--mantine-color-dimmed)" />
                      <Text fw={500}>Ce dossier est vide</Text>
                      <Text c="dimmed" size="sm">
                        Faites un clic droit pour créer un dossier ou importer, ou glissez des fichiers ici.
                      </Text>
                    </Stack>
                  </Center>
                ) : null}
              </Stack>
            </Dropzone>
          </Box>

          {lassoRect ? (
            <Box
              pos="fixed"
              left={lassoRect.left}
              top={lassoRect.top}
              w={lassoRect.right - lassoRect.left}
              h={lassoRect.bottom - lassoRect.top}
              style={{
                zIndex: 10,
                pointerEvents: 'none',
                border: '1px solid var(--mantine-primary-color-filled)',
                backgroundColor: 'var(--mantine-primary-color-light)',
                borderRadius: 'var(--mantine-radius-xs)',
              }}
            />
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept={limits.allowedMimeTypes.join(',')}
            onChange={(event) => {
              startUpload(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />

          <ContextMenu state={contextMenu.state} onClose={contextMenu.close} />

          <NameModal
            opened={dialog?.type === 'create'}
            title="Nouveau dossier"
            label="Nom du dossier"
            submitLabel="Créer"
            loading={mutations.createFolder.isPending}
            onClose={closeDialog}
            onSubmit={(name) =>
              void mutations.createFolder.mutateAsync({ parentId: folderId, name }).then(closeDialog, () => undefined)
            }
          />

          <NameModal
            opened={dialog?.type === 'rename'}
            title="Renommer"
            label="Nouveau nom"
            submitLabel="Renommer"
            initialValue={dialog?.type === 'rename' ? dialog.target.item.name : ''}
            selectBaseName={dialog?.type === 'rename' && dialog.target.kind === 'file'}
            loading={mutations.updateFolder.isPending || mutations.updateFile.isPending}
            onClose={closeDialog}
            onSubmit={(name) => dialog?.type === 'rename' && handleRename(dialog.target, name)}
          />

          <MoveModal
            opened={dialog?.type === 'move' && dialogTargets.length > 0}
            title={
              dialogTargets.length > 1
                ? `Déplacer ${dialogTargets.length} éléments`
                : `Déplacer « ${dialogTargets[0]?.item.name ?? ''} »`
            }
            // Everything shown lives in the current folder.
            currentParentId={folderId}
            excludeFolderIds={dialogTargets.filter((target) => target.kind === 'folder').map((target) => target.item.id)}
            loading={mutations.moveItems.isPending}
            onClose={closeDialog}
            onSubmit={(destination) => void moveKeys(dialogKeys, destination).then(closeDialog, () => undefined)}
          />

          <DeleteModal
            opened={dialog?.type === 'delete' && dialogTargets.length > 0}
            items={dialogTargets.map((target) => ({ name: target.item.name, isFolder: target.kind === 'folder' }))}
            loading={mutations.deleteItems.isPending}
            onClose={closeDialog}
            onConfirm={() => void deleteKeys(dialogKeys).then(closeDialog, () => undefined)}
          />

          <MediaViewer
            files={files}
            index={previewIndex >= 0 ? previewIndex : null}
            onIndexChange={(index) => {
              const file = files[index];
              if (file) {
                setPreviewId(file.id);
                setSelection(selectOnly(itemKey('file', file.id)));
              }
            }}
            onDownload={(id) => void download(id)}
            onCopyShareLink={share.enabled ? share.copyLink : undefined}
            onExpired={() => void invalidate()}
            onClose={() => setPreviewId(null)}
          />
          <UploadQueue items={uploads.items} onClear={uploads.clearFinished} />
        </Stack>
        <DragOverlay dropAnimation={null}>
          {dragged ? <DragChip items={dragged.items} name={dragged.name} /> : null}
        </DragOverlay>
      </DraggedItemsContext.Provider>
    </DndContext>
  );
}
