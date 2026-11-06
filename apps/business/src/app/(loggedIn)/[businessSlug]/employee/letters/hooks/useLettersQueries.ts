'use client';

import { useCallback } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { REALTIME_DOMAIN, realtimeMutationMeta, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import {
  useOptionalRealtimeSocket,
  useRealtimeSocketEvents,
  useRealtimeSocketResync,
} from '@lawless-intranet/realtime/socket';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { lettersKeys } from '@/lib/letters/queryKeys';
import type { LetterCorrespondentDTO, LetterDTO } from '@/types/letters';

export type ConversationFilters = { search: string; includeArchived: boolean };

export function useLetterCorrespondents(boxId: string | null, initialData?: LetterCorrespondentDTO[]) {
  const slug = useRequiredBusinessSlug();
  return useQuery({
    queryKey: lettersKeys.correspondents(slug, boxId ?? ''),
    queryFn: async () => handleAction(await fetchRead(slug, 'letterCorrespondents', { boxId: boxId ?? '' })),
    enabled: Boolean(boxId),
    initialData,
  });
}

export function useLetterConversation(
  boxId: string | null,
  correspondentId: string | null,
  filters: ConversationFilters,
  initialData?: LetterDTO[],
) {
  const slug = useRequiredBusinessSlug();
  return useQuery({
    queryKey: lettersKeys.conversation(slug, boxId ?? '', correspondentId ?? '', filters),
    queryFn: async () =>
      handleAction(
        await fetchRead(slug, 'letters', {
          boxId: boxId ?? '',
          correspondentId: correspondentId ?? '',
          search: filters.search || undefined,
          includeArchived: filters.includeArchived,
        }),
      ),
    enabled: Boolean(boxId && correspondentId),
    initialData,
    // Keeps the bubbles while a search narrows them (no flash to empty).
    placeholderData: keepPreviousData,
    // Image links are signed for 1 h: refresh before they expire.
    refetchInterval: 30 * 60 * 1000,
  });
}

export function useLetterSearch(boxId: string | null, query: string, includeArchived: boolean) {
  const slug = useRequiredBusinessSlug();
  const trimmed = query.trim();
  return useQuery({
    queryKey: lettersKeys.search(slug, boxId ?? '', trimmed, includeArchived),
    queryFn: async () =>
      handleAction(await fetchRead(slug, 'letterSearch', { boxId: boxId ?? '', query: trimmed, includeArchived })),
    enabled: Boolean(boxId) && trimmed.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useLetterBoxMembers(boxId: string | null, enabled: boolean) {
  const slug = useRequiredBusinessSlug();
  return useQuery({
    queryKey: lettersKeys.members(slug, boxId ?? ''),
    queryFn: async () => handleAction(await fetchRead(slug, 'letterBoxMembers', { boxId: boxId ?? '' })),
    enabled: enabled && Boolean(boxId),
  });
}

/** Everything of a box (contacts, conversations, search, members) after a change. */
export function useInvalidateLetterBox() {
  const slug = useRequiredBusinessSlug();
  const queryClient = useQueryClient();
  return useCallback(
    (boxId: string) => queryClient.invalidateQueries({ queryKey: lettersKeys.box(slug, boxId) }),
    [queryClient, slug],
  );
}

/** Meta of this tab's mutations: the realtime server does not echo them back. */
export function useLettersMutationMeta() {
  const socket = useOptionalRealtimeSocket();
  return realtimeMutationMeta(socket?.clientId);
}

const DOMAINS = [REALTIME_DOMAIN.letters] as const;

/** Another member changed the box: refetch what is shown. */
export function useLettersRealtime(boxId: string | null) {
  const invalidate = useInvalidateLetterBox();
  const handleEvent = useCallback(
    (envelope: RealtimeEnvelope) => {
      const changed = (envelope.payload as { boxId?: string } | null)?.boxId;
      if (boxId && changed === boxId) void invalidate(boxId);
    },
    [boxId, invalidate],
  );
  useRealtimeSocketEvents({ enabled: Boolean(boxId), domains: DOMAINS, coalesceMs: 250, onEvent: handleEvent });
  const resync = useCallback(() => {
    if (boxId) void invalidate(boxId);
  }, [boxId, invalidate]);
  useRealtimeSocketResync(resync, Boolean(boxId));
}

type ActionResult = Parameters<typeof handleAction>[0];

/**
 * Mutation of a box: runs the server action, refreshes the box, notifies.
 * The success message can depend on the result (e.g. the new serial).
 */
export function useLetterBoxMutation<V, R extends ActionResult>(
  boxId: string | null,
  run: (slug: string, vars: V, meta: ReturnType<typeof realtimeMutationMeta>) => Promise<R>,
  messages: { success?: string | ((data: NonNullable<R['data']>) => string); error: string },
) {
  const slug = useRequiredBusinessSlug();
  const meta = useLettersMutationMeta();
  const invalidate = useInvalidateLetterBox();
  return useMutation({
    mutationFn: async (vars: V) => handleAction(await run(slug, vars, meta)) as NonNullable<R['data']>,
    onSuccess: (data) => {
      if (boxId) void invalidate(boxId);
      const message = typeof messages.success === 'function' ? messages.success(data) : messages.success;
      if (message) notifications.show({ title: 'Lettres', message, color: 'moss' });
    },
    onError: (error: Error) =>
      notifications.show({ title: 'Erreur', message: error.message || messages.error, color: 'danger' }),
  });
}
