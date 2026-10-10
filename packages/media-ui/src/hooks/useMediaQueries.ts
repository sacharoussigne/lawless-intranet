'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { MediaFileRecord, MediaFolderContentsRecord } from '@lawless-intranet/types';
import { copyImageToClipboard } from '../clipboard';
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

/** Uploader name for « Informations »: null when the host cannot resolve it. */
export function useMediaUserName(userId: string | null) {
  const { actions, scopeKey } = useMediaUi();
  const getUserName = actions.getUserName;
  return useQuery({
    queryKey: mediaKeys.userName(scopeKey, userId ?? ''),
    queryFn: async () => (getUserName && userId ? runMediaAction(await getUserName(userId)) : null),
    enabled: Boolean(getUserName && userId),
    staleTime: Infinity,
    retry: false,
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

/** `name` (single item) only feeds the notification. */
type BatchInput = { folderIds: string[]; fileIds: string[]; name: string };

function batchMessage({ folderIds, fileIds, name }: BatchInput, verb: string): string {
  const count = folderIds.length + fileIds.length;
  return count > 1 ? `${count} éléments ${verb}s` : `« ${name} » ${verb}`;
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
    onError: (error) => notifyError(error, 'Modification impossible'),
    onSettled: invalidate,
  });

  const updateFile = useMutation({
    mutationFn: async (input: { id: string; name?: string; folderId?: string | null }) =>
      runMediaAction(await actions.updateFile(input)),
    onError: (error) => notifyError(error, 'Modification impossible'),
    onSettled: invalidate,
  });

  const moveItems = useMutation({
    mutationFn: async ({ name: _name, ...input }: BatchInput & { destinationId: string | null }) =>
      runMediaAction(await actions.moveItems(input)),
    onSuccess: (_result, input) => notifySuccess(batchMessage(input, 'déplacé')),
    onError: (error) => notifyError(error, 'Déplacement impossible'),
    onSettled: invalidate,
  });

  const deleteItems = useMutation({
    mutationFn: async ({ name: _name, ...input }: BatchInput) => runMediaAction(await actions.deleteItems(input)),
    onSuccess: (_result, input) => notifySuccess(batchMessage(input, 'supprimé')),
    onError: (error) => notifyError(error, 'Suppression impossible'),
    onSettled: invalidate,
  });

  return { createFolder, updateFolder, updateFile, moveItems, deleteItems };
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

/** Copies an image file into the clipboard (preview URL, or a fresh signed URL when missing). */
export function useMediaCopyImage() {
  const { actions } = useMediaUi();
  return async (file: MediaFileRecord) => {
    const getUrl = async () =>
      file.previewUrl ?? runMediaAction(await actions.getDownloadUrl(file.id)).url;
    try {
      await copyImageToClipboard(getUrl);
      notifySuccess(`« ${file.name} » copiée dans le presse-papier`);
    } catch (error) {
      notifyError(error, 'Copie de l’image impossible');
    }
  };
}

/**
 * Public share links: « copy » creates the link on first use (then always the same),
 * « revoke » kills it (sharing again gives a new link).
 */
export function useMediaShare() {
  const { actions, buildShareUrl } = useMediaUi();
  const invalidate = useInvalidateMedia();

  const share = useMutation({
    mutationFn: async (id: string) => runMediaAction(await actions.shareFile(id)),
    onError: (error) => notifyError(error, 'Partage impossible'),
    onSettled: invalidate,
  });

  const unshare = useMutation({
    mutationFn: async (id: string) => runMediaAction(await actions.unshareFile(id)),
    onSuccess: (file) => notifySuccess(`Lien de partage de « ${file.name} » désactivé`),
    onError: (error) => notifyError(error, 'Désactivation impossible'),
    onSettled: invalidate,
  });

  const copyLink = async (file: MediaFileRecord) => {
    if (!buildShareUrl) return;
    let token = file.shareToken;
    if (!token) {
      try {
        token = (await share.mutateAsync(file.id)).shareToken;
      } catch {
        return;
      }
    }
    if (!token) return;
    const url = buildShareUrl(token, file.name);
    // Phones: the native share sheet (Discord, Messages…). It needs the user activation, which a
    // first share (server round-trip) may have used up: any refusal falls back to the clipboard.
    if (typeof navigator.share === 'function' && window.matchMedia('(hover: none)').matches) {
      try {
        await navigator.share({ title: file.name, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notifySuccess('Lien de partage copié');
    } catch {
      // Clipboard refused (permissions, focus): show the link so it can be copied by hand.
      notifications.show({ title: 'Lien de partage', message: url, color: 'moss', autoClose: false });
    }
  };

  return {
    enabled: buildShareUrl !== undefined,
    copyLink: (file: MediaFileRecord) => void copyLink(file),
    revoke: (file: MediaFileRecord) => unshare.mutate(file.id),
  };
}
