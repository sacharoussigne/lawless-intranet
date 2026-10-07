'use client';

import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from 'react';
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
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertTriangle, IconChevronDown, IconUpload } from '@tabler/icons-react';
import type {
  MediaFileRecord,
  MediaFolderContentsRecord,
  MediaFolderRecord,
} from '@lawless-intranet/types';
import { ContextMenu, useContextMenu } from './components/ContextMenu';
import { DeleteModal } from './components/DeleteModal';
import { DragChip, FileCard, FolderCard, useDropHighlight } from './components/MediaItemCards';
import { BackgroundMenuItems, FileMenuItems, FolderMenuItems } from './components/MediaMenus';
import { MoveModal } from './components/MoveModal';
import { NameModal } from './components/NameModal';
import { MediaViewer } from './components/MediaViewer';
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

export const MEDIA_FOLDER_PARAM = 'folder';

/** Same columns for folders and files so both grids line up, like Drive. */
const GRID_COLS = { base: 1, xs: 2, sm: 3, md: 4, xl: 5 };

type Target =
  | { kind: 'folder'; item: MediaFolderRecord }
  | { kind: 'file'; item: MediaFileRecord };

type Dialog =
  | { type: 'create' }
  | { type: 'rename'; target: Target }
  | { type: 'move'; target: Target }
  | { type: 'delete'; target: Target }
  | null;

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
 * Drive-like library: right-click menus (background and items), click to select,
 * double-click to open, drag & drop upload, rename, move, delete, preview.
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
  const openOnClick = useMediaQuery('(hover: none)') ?? false;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const invalidate = useInvalidateMedia();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<{ item: DragItem; name: string } | null>(null);
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

  const closeDialog = () => setDialog(null);
  const contents = contentsQuery.data;
  const breadcrumb = contents?.breadcrumb ?? [];
  const files = contents?.files ?? [];
  // Derived from the live list: a deleted file closes the viewer, a refetch refreshes its URL.
  const previewIndex = previewId ? files.findIndex((file) => file.id === previewId) : -1;
  const currentFolderName = breadcrumb.at(-1)?.name ?? 'Médiathèque';

  const handleRename = (target: Target, name: string) => {
    const mutation =
      target.kind === 'folder'
        ? mutations.updateFolder.mutateAsync({ id: target.item.id, name })
        : mutations.updateFile.mutateAsync({ id: target.item.id, name });
    void mutation.then(closeDialog, () => undefined);
  };

  const handleMove = (target: Target, destination: string | null) => {
    const mutation =
      target.kind === 'folder'
        ? mutations.updateFolder.mutateAsync({ id: target.item.id, parentId: destination })
        : mutations.updateFile.mutateAsync({ id: target.item.id, folderId: destination });
    void mutation.then(closeDialog, () => undefined);
  };

  const handleDelete = (target: Target) => {
    const mutation =
      target.kind === 'folder'
        ? mutations.deleteFolder.mutateAsync(target.item.id)
        : mutations.deleteFile.mutateAsync(target.item.id);
    void mutation.then(closeDialog, () => undefined);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current as DragItem | undefined;
    if (!item) return;
    const source = item.kind === 'folder' ? contents?.folders : contents?.files;
    setDragged({ item, name: source?.find((entry) => entry.id === item.id)?.name ?? '' });
    setSelectedId(item.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragged(null);
    const item = event.active.data.current as DragItem | undefined;
    const destination = event.over ? parseDropId(String(event.over.id)) : undefined;
    if (!item || destination === undefined || !canDrop(item, destination)) return;
    if (item.kind === 'folder') mutations.updateFolder.mutate({ id: item.id, parentId: destination });
    else mutations.updateFile.mutate({ id: item.id, folderId: destination });
  };

  const startUpload = (files: File[]) => {
    if (files.length > 0) void uploads.upload(files, folderId);
  };

  const backgroundMenu = (
    <BackgroundMenuItems
      onCreateFolder={() => setDialog({ type: 'create' })}
      onUpload={() => fileInputRef.current?.click()}
      uploadDisabled={!limits.storageConfigured}
    />
  );

  const itemActions = (target: Target) => ({
    onRename: () => setDialog({ type: 'rename', target }),
    onMove: () => setDialog({ type: 'move', target }),
    onDelete: () => setDialog({ type: 'delete', target }),
  });

  const tileInteractions = (id: string, onOpen: () => void, target: Target, menu: ReactNode) => ({
    dragItem: {
      kind: target.kind,
      id,
      parentId: target.kind === 'folder' ? target.item.parentId : target.item.folderId,
    },
    selected: selectedId === id,
    openOnClick,
    onSelect: () => setSelectedId(id),
    onOpen,
    onDeleteKey: () => setDialog({ type: 'delete', target }),
    onContextMenu: (event: MouseEvent) => {
      setSelectedId(id);
      contextMenu.open(event, menu);
    },
    menu,
  });

  const folderTile = (folder: MediaFolderRecord) => {
    const target: Target = { kind: 'folder', item: folder };
    const href = folderHref(folder.id);
    const open = () => router.push(href);
    const menu = <FolderMenuItems onOpen={open} {...itemActions(target)} />;
    return <FolderCard key={folder.id} folder={folder} href={href} {...tileInteractions(folder.id, open, target, menu)} />;
  };

  const fileTile = (file: MediaFileRecord) => {
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
        {...itemActions(target)}
      />
    );
    return <FileCard key={file.id} file={file} {...tileInteractions(file.id, open, target, menu)} />;
  };

  const updating = mutations.updateFolder.isPending || mutations.updateFile.isPending;
  const deleting = mutations.deleteFolder.isPending || mutations.deleteFile.isPending;
  const isEmpty = contents && contents.folders.length === 0 && contents.files.length === 0;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragged(null)}
    >
      <Stack gap="md">
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
          onClick={() => setSelectedId(null)}
          onContextMenu={(event) => {
            setSelectedId(null);
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

              {contents && contents.folders.length > 0 ? (
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Dossiers
                  </Text>
                  <SimpleGrid cols={GRID_COLS} spacing="sm">
                    {contents.folders.map(folderTile)}
                  </SimpleGrid>
                </Stack>
              ) : null}

              {contents && contents.files.length > 0 ? (
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Fichiers
                  </Text>
                  <SimpleGrid cols={GRID_COLS} spacing="sm">
                    {contents.files.map(fileTile)}
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
          loading={updating}
          onClose={closeDialog}
          onSubmit={(name) => dialog?.type === 'rename' && handleRename(dialog.target, name)}
        />

        <MoveModal
          opened={dialog?.type === 'move'}
          itemName={dialog?.type === 'move' ? dialog.target.item.name : ''}
          currentParentId={
            dialog?.type === 'move'
              ? dialog.target.kind === 'folder'
                ? dialog.target.item.parentId
                : dialog.target.item.folderId
              : null
          }
          excludeFolderId={dialog?.type === 'move' && dialog.target.kind === 'folder' ? dialog.target.item.id : undefined}
          loading={updating}
          onClose={closeDialog}
          onSubmit={(destination) => dialog?.type === 'move' && handleMove(dialog.target, destination)}
        />

        <DeleteModal
          opened={dialog?.type === 'delete'}
          itemName={dialog?.type === 'delete' ? dialog.target.item.name : ''}
          isFolder={dialog?.type === 'delete' && dialog.target.kind === 'folder'}
          loading={deleting}
          onClose={closeDialog}
          onConfirm={() => dialog?.type === 'delete' && handleDelete(dialog.target)}
        />

        <MediaViewer
          files={files}
          index={previewIndex >= 0 ? previewIndex : null}
          onIndexChange={(index) => {
            const file = files[index];
            if (file) {
              setPreviewId(file.id);
              setSelectedId(file.id);
            }
          }}
          onDownload={(id) => void download(id)}
          onExpired={() => void invalidate()}
          onClose={() => setPreviewId(null)}
        />
        <UploadQueue items={uploads.items} onClear={uploads.clearFinished} />
      </Stack>
      <DragOverlay dropAnimation={null}>
        {dragged ? <DragChip name={dragged.name} kind={dragged.item.kind} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
