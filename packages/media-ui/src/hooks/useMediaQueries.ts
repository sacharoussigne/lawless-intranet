'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { MediaFolderContentsRecord } from '@lawless-intranet/types';
import { useMediaUi } from '../MediaUiProvider';
import { mediaKeys } from '../queryKeys';
import { runMediaAction } from '../runMediaAction';

/** Preview URLs are signed for 1 h: refetch well before they expire. */
const CONTENTS_STALE_TIME_MS = 30 * 60 * 1000;

export function useMediaFolderContents(
  folderId: string | null,
  initial?: { folderId: string | null; contents: MediaFolderContentsRecord },
) {
  const { actions, scopeKey } = useMediaUi();
  return useQuery({
    queryKey: mediaKeys.folder(scopeKey, folderId),
    queryFn: async () => runMediaAction(await actions.getFolderContents(folderId)),
    initialData: initial && initial.folderId === folderId ? initial.contents : undefined,
    staleTime: CONTENTS_STALE_TIME_MS,
    refetchInterval: CONTENTS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}

export function useMediaFolderTree(enabled: boolean) {
  const { actions, scopeKey } = useMediaUi();
  return useQuery({
    queryKey: mediaKeys.tree(scopeKey),
    queryFn: async () => runMediaAction(await actions.getFolderTree()),
    enabled,
  });
}

export function useInvalidateMedia() {
  const queryClient = useQueryClient();
  const { scopeKey } = useMediaUi();
  return () => queryClient.invalidateQueries({ queryKey: mediaKeys.all(scopeKey) });
}

function notifyError(error: unknown, fallback: string) {
  notifications.show({
    title: 'Erreur',
    message: error instanceof Error ? error.message : fallback,
    color: 'danger',
  });
}

function notifySuccess(message: string) {
  notifications.show({ title: 'Médiathèque', message, color: 'moss' });
}

/** Every mutation refreshes the whole library cache (contents + tree). */
export function useMediaMutations() {
  const { actions } = useMediaUi();
  const invalidate = useInvalidateMedia();

  const createFolder = useMutation({
    mutationFn: async (input: { parentId: string | null; name: string }) =>
      runMediaAction(await actions.createFolder(input)),
    onSuccess: (folder) => notifySuccess(`Dossier « ${folder.name} » créé`),
    onError: (error) => notifyError(error, 'Création impossible'),
    onSettled: invalidate,
  });

  const updateFolder = useMutation({
    mutationFn: async (input: { id: string; name?: string; parentId?: string | null }) =>
      runMediaAction(await actions.updateFolder(input)),
    onSuccess: (folder, input) => {
      if (input.parentId !== undefined) notifySuccess(`« ${folder.name} » déplacé`);
    },
    onError: (error) => notifyError(error, 'Modification impossible'),
    onSettled: invalidate,
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => runMediaAction(await actions.deleteFolder(id)),
    onSuccess: () => notifySuccess('Dossier supprimé'),
    onError: (error) => notifyError(error, 'Suppression impossible'),
    onSettled: invalidate,
  });

  const updateFile = useMutation({
    mutationFn: async (input: { id: string; name?: string; folderId?: string | null }) =>
      runMediaAction(await actions.updateFile(input)),
    onSuccess: (file, input) => {
      if (input.folderId !== undefined) notifySuccess(`« ${file.name} » déplacé`);
    },
    onError: (error) => notifyError(error, 'Modification impossible'),
    onSettled: invalidate,
  });

  const deleteFile = useMutation({
    mutationFn: async (id: string) => runMediaAction(await actions.deleteFile(id)),
    onSuccess: () => notifySuccess('Fichier supprimé'),
    onError: (error) => notifyError(error, 'Suppression impossible'),
    onSettled: invalidate,
  });

  return { createFolder, updateFolder, deleteFolder, updateFile, deleteFile };
}

export function useMediaDownload() {
  const { actions } = useMediaUi();
  return async (fileId: string) => {
    try {
      const { url } = runMediaAction(await actions.getDownloadUrl(fileId));
      window.location.assign(url);
    } catch (error) {
      notifyError(error, 'Téléchargement impossible');
    }
  };
}
