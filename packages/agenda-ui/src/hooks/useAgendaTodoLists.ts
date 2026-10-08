'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeSocketResync } from '@lawless-intranet/realtime/socket';
import { notifications } from '@mantine/notifications';
import { useAgendaUi } from '../AgendaUiProvider';
import { agendaKeys } from '../queryKeys';
import { useAgendaRealtime } from '../realtime/useAgendaRealtime';
import { runAgendaAction } from '../runAgendaAction';
import type { AgendaTodoListDTO } from '../types';

type UseAgendaTodoListsOptions = {
  agendaId: string | null;
  initialLists: AgendaTodoListDTO[];
  /** True when `initialLists` (SSR) are the lists of `agendaId`. */
  skipInitialFetch?: boolean;
  isDragging?: boolean;
};

const EMPTY_LISTS: AgendaTodoListDTO[] = [];

/**
 * Todo lists of an agenda, cached in React Query.
 *
 * Local mutations update the cache optimistically between
 * `beginLocalMutation` / `endLocalMutation`; in-flight fetches are cancelled
 * at the start and the lists are refetched once the last mutation settles,
 * so the cache always converges to the server state. Remote changes arriving
 * while a mutation or a drag is in progress are deferred, never dropped.
 */
export function useAgendaTodoLists({
  agendaId,
  initialLists,
  skipInitialFetch = false,
  isDragging = false,
}: UseAgendaTodoListsOptions) {
  const { actions, scopeKey } = useAgendaUi();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => agendaKeys.todos(scopeKey, agendaId ?? ''), [scopeKey, agendaId]);

  const pendingMutationsRef = useRef(0);
  const pendingRemoteRefreshRef = useRef(false);
  const isDraggingRef = useRef(isDragging);
  const agendaIdRef = useRef(agendaId);
  const [selectedListId, setSelectedListId] = useState<string | null>(
    initialLists[0]?.id ?? null,
  );
  /** In-flight local mutations per key (`task:<id>`, `reorder`…), for loading indicators. */
  const [pendingKeys, setPendingKeys] = useState<ReadonlyMap<string, number>>(() => new Map());

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await actions.listTodoLists(agendaId as string);
      return runAgendaAction(result) ?? [];
    },
    enabled: Boolean(agendaId),
    initialData: skipInitialFetch ? initialLists : undefined,
  });

  const lists = agendaId ? (query.data ?? EMPTY_LISTS) : EMPTY_LISTS;
  const selectedList = lists.find((list) => list.id === selectedListId) ?? lists[0] ?? null;

  useEffect(() => {
    if (!query.error) return;
    notifications.show({
      title: 'Erreur',
      message: query.error instanceof Error ? query.error.message : 'Chargement impossible',
      color: 'danger',
    });
  }, [query.error]);

  const setLists = useCallback<Dispatch<SetStateAction<AgendaTodoListDTO[]>>>(
    (update) => {
      queryClient.setQueryData<AgendaTodoListDTO[]>(queryKey, (previous) =>
        typeof update === 'function' ? update(previous ?? EMPTY_LISTS) : update,
      );
    },
    [queryClient, queryKey],
  );

  const refetchLists = useCallback(async () => {
    pendingRemoteRefreshRef.current = false;
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const requestRemoteRefresh = useCallback(() => {
    if (pendingMutationsRef.current > 0 || isDraggingRef.current) {
      pendingRemoteRefreshRef.current = true;
      return;
    }
    void refetchLists();
  }, [refetchLists]);

  const beginLocalMutation = useCallback(
    (key: string) => {
      pendingMutationsRef.current += 1;
      setPendingKeys((prev) => new Map(prev).set(key, (prev.get(key) ?? 0) + 1));
      // A fetch started before the optimistic update must not overwrite it.
      void queryClient.cancelQueries({ queryKey });
    },
    [queryClient, queryKey],
  );

  const endLocalMutation = useCallback(
    (key: string) => {
      pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1);
      setPendingKeys((prev) => {
        const next = new Map(prev);
        const count = (next.get(key) ?? 0) - 1;
        if (count > 0) next.set(key, count);
        else next.delete(key);
        return next;
      });
      if (pendingMutationsRef.current === 0 && !isDraggingRef.current) {
        void refetchLists();
      }
    },
    [refetchLists],
  );

  const isPending = useCallback((key: string) => pendingKeys.has(key), [pendingKeys]);

  useEffect(() => {
    agendaIdRef.current = agendaId;
  }, [agendaId]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
    if (!isDragging && pendingRemoteRefreshRef.current && pendingMutationsRef.current === 0) {
      void refetchLists();
    }
  }, [isDragging, refetchLists]);

  useAgendaRealtime({
    enabled: Boolean(agendaId),
    onTodosChange: (event) => {
      if (event.agendaId && event.agendaId !== agendaIdRef.current) return;
      requestRemoteRefresh();
    },
  });

  useRealtimeSocketResync(requestRemoteRefresh, Boolean(agendaId));

  return {
    lists,
    setLists,
    selectedListId: selectedList?.id ?? null,
    setSelectedListId,
    selectedList,
    reload: refetchLists,
    beginLocalMutation,
    endLocalMutation,
    isPending,
    isSaving: pendingKeys.size > 0,
  };
}
