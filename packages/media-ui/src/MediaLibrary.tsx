'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Center,
  FileButton,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconAlertTriangle, IconFolderPlus, IconUpload } from '@tabler/icons-react';
import type {
  MediaFileRecord,
  MediaFolderContentsRecord,
  MediaFolderRecord,
} from '@lawless-intranet/types';
import { DeleteModal } from './components/DeleteModal';
import { FileCard, FolderCard } from './components/MediaItemCards';
import { MoveModal } from './components/MoveModal';
import { NameModal } from './components/NameModal';
import { PreviewModal } from './components/PreviewModal';
import { UploadQueue } from './components/UploadQueue';
import { useMediaDownload, useMediaFolderContents, useMediaMutations } from './hooks/useMediaQueries';
import { useMediaRealtime } from './hooks/useMediaRealtime';
import { useMediaUploads } from './hooks/useMediaUploads';
import { useMediaUi } from './MediaUiProvider';

export const MEDIA_FOLDER_PARAM = 'folder';

type Target =
  | { kind: 'folder'; item: MediaFolderRecord }
  | { kind: 'file'; item: MediaFileRecord };

type Dialog =
  | { type: 'create' }
  | { type: 'rename'; target: Target }
  | { type: 'move'; target: Target }
  | { type: 'delete'; target: Target }
  | null;

export type MediaLibraryProps = {
  /** Contents loaded by the server component for `initialFolderId`. */
  initialContents?: MediaFolderContentsRecord;
  initialFolderId?: string | null;
};

/** Drive-like library: folders, upload (drag & drop), rename, move, delete, preview. */
export function MediaLibrary({ initialContents, initialFolderId = null }: MediaLibraryProps) {
  const { limits } = useMediaUi();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const folderId = searchParams.get(MEDIA_FOLDER_PARAM);

  const contentsQuery = useMediaFolderContents(
    folderId,
    initialContents ? { folderId: initialFolderId, contents: initialContents } : undefined,
  );
  const mutations = useMediaMutations();
  const download = useMediaDownload();
  const uploads = useMediaUploads();
  useMediaRealtime();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [preview, setPreview] = useState<MediaFileRecord | null>(null);

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

  const itemActions = (target: Target) => ({
    onRename: () => setDialog({ type: 'rename', target }),
    onMove: () => setDialog({ type: 'move', target }),
    onDelete: () => setDialog({ type: 'delete', target }),
  });

  const startUpload = (files: File[]) => {
    if (files.length > 0) void uploads.upload(files, folderId);
  };

  const updating = mutations.updateFolder.isPending || mutations.updateFile.isPending;
  const deleting = mutations.deleteFolder.isPending || mutations.deleteFile.isPending;
  const isEmpty = contents && contents.folders.length === 0 && contents.files.length === 0;

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Breadcrumbs separatorMargin={6}>
          <Anchor component={Link} href={folderHref(null)} size="sm">
            Médiathèque
          </Anchor>
          {(contents?.breadcrumb ?? []).map((crumb) => (
            <Anchor key={crumb.id} component={Link} href={folderHref(crumb.id)} size="sm">
              {crumb.name}
            </Anchor>
          ))}
        </Breadcrumbs>
        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<IconFolderPlus size={16} />}
            onClick={() => setDialog({ type: 'create' })}
          >
            Nouveau dossier
          </Button>
          <FileButton onChange={startUpload} accept={limits.allowedMimeTypes.join(',')} multiple>
            {(props) => (
              <Button {...props} leftSection={<IconUpload size={16} />} disabled={!limits.storageConfigured}>
                Importer
              </Button>
            )}
          </FileButton>
        </Group>
      </Group>

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

      <Dropzone
        onDrop={startUpload}
        activateOnClick={false}
        disabled={!limits.storageConfigured}
        multiple
        // Validation (type, size) is done by the upload queue for clear per-file errors.
        styles={{ root: { border: 0, padding: 0, background: 'transparent' } }}
      >
        <Stack gap="lg" mih={240}>
          {!contents ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : null}

          {contents && contents.folders.length > 0 ? (
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm">
              {contents.folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  href={folderHref(folder.id)}
                  {...itemActions({ kind: 'folder', item: folder })}
                />
              ))}
            </SimpleGrid>
          ) : null}

          {contents && contents.files.length > 0 ? (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="sm">
              {contents.files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onPreview={() => setPreview(file)}
                  onDownload={() => void download(file.id)}
                  {...itemActions({ kind: 'file', item: file })}
                />
              ))}
            </SimpleGrid>
          ) : null}

          {isEmpty ? (
            <Center py="xl">
              <Stack gap={4} align="center">
                <IconUpload size={32} stroke={1.25} color="var(--mantine-color-dimmed)" />
                <Text c="dimmed" size="sm">
                  Ce dossier est vide. Glissez des fichiers ici ou utilisez « Importer ».
                </Text>
              </Stack>
            </Center>
          ) : null}
        </Stack>
      </Dropzone>

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

      <PreviewModal file={preview} onDownload={(id) => void download(id)} onClose={() => setPreview(null)} />
      <UploadQueue items={uploads.items} onClear={uploads.clearFinished} />
    </Stack>
  );
}
