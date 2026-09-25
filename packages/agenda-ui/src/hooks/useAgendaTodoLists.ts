'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgendaUi } from '../AgendaUiProvider';
import { runAgendaAction } from '../runAgendaAction';
import { runAsyncEffect } from '../runAsyncEffect';
import { shouldApplyRemoteLists } from '../todoListsSync';
import type { AgendaTodoListDTO } from '../types';
import { notifications } from '@mantine/notifications';

type UseAgendaTodoListsOptions = {
  agendaId: string | null;
  initialLists: AgendaTodoListDTO[];
  skipInitialFetch?: boolean;
  remoteTodosToken?: number;
  isDragging?: boolean;
};

function showListsLoadError(error: unknown) {
  notifications.show({
    title: 'Erreur',
    message: error instanceof Error ? error.message : 'Chargement impossible',
    color: 'danger',
  });
}

export function useAgendaTodoLists({
  agendaId,
  initialLists,
  skipInitialFetch = false,
  remoteTodosToken = 0,
  isDragging = false,
}: UseAgendaTodoListsOptions) {
  const { actions } = useAgendaUi();
  const skipInitialFetchRef = useRef(skipInitialFetch);
  const pendingRemoteReloadRef = useRef(false);
  const listsEpochRef = useRef(0);
  const pendingMutationsRef = useRef(0);
  const [mutationGate, setMutationGate] = useState(0);
  const [lists, setLists] = useState<AgendaTodoListDTO[]>(initialLists);
  const [selectedListId, setSelectedListId] = useState<string | null>(
    initialLists[0]?.id ?? null,
  );
  const [syncedAgendaId, setSyncedAgendaId] = useState(agendaId);

  if (agendaId !== syncedAgendaId) {
    setSyncedAgendaId(agendaId);
    if (!agendaId) {
      setLists([]);
      setSelectedListId(null);
    }
  }

  const selectedList = lists.find((list) => list.id === selectedListId) ?? lists[0] ?? null;

  const applyLists = useCallback((data: AgendaTodoListDTO[]) => {
    setLists(data);
    setSelectedListId((current) =>
      current && data.some((list) => list.id === current)
        ? current
        : (data[0]?.id ?? null),
    );
  }, []);

  const bumpListsEpoch = useCallback(() => {
    listsEpochRef.current += 1;
  }, []);

  const beginLocalMutation = useCallback(() => {
    pendingMutationsRef.current += 1;
    bumpListsEpoch();
  }, [bumpListsEpoch]);

  const endLocalMutation = useCallback(() => {
    pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1);
    if (pendingMutationsRef.current === 0 && pendingRemoteReloadRef.current) {
      setMutationGate((value) => value + 1);
    }
  }, []);

  const fetchTodoLists = useCallback(async () => {
    if (!agendaId) return null;
    const result = await actions.listTodoLists(agendaId);
    return runAgendaAction(result) ?? null;
  }, [actions, agendaId]);

  const reload = useCallback(async () => {
    if (!agendaId) return;
    const epochAtStart = listsEpochRef.current;
    try {
      const data = await fetchTodoLists();
      if (!data) return;
      if (!shouldApplyRemoteLists(epochAtStart, listsEpochRef.current)) return;
      applyLists(data);
    } catch (error: unknown) {
      showListsLoadError(error);
    }
  }, [agendaId, applyLists, fetchTodoLists]);

  const fetchListsIntoState = useCallback(
    (isCancelled: () => boolean) => {
      const epochAtStart = listsEpochRef.current;
      runAsyncEffect(fetchTodoLists, {
        isCancelled,
        onSuccess: (data) => {
          if (!data) return;
          if (!shouldApplyRemoteLists(epochAtStart, listsEpochRef.current)) return;
          applyLists(data);
        },
        onError: showListsLoadError,
      });
    },
    [applyLists, fetchTodoLists],
  );

  const shouldDeferRemoteReload = isDragging || pendingMutationsRef.current > 0;

  useEffect(() => {
    if (!agendaId) return;

    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }

    let cancelled = false;
    fetchListsIntoState(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [agendaId, fetchListsIntoState]);

  useEffect(() => {
    if (remoteTodosToken === 0) return;

    if (isDragging || pendingMutationsRef.current > 0) {
      pendingRemoteReloadRef.current = true;
      return;
    }

    let cancelled = false;
    fetchListsIntoState(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [remoteTodosToken, fetchListsIntoState, isDragging]);

  useEffect(() => {
    if (isDragging || pendingMutationsRef.current > 0) return;
    if (!pendingRemoteReloadRef.current) return;

    pendingRemoteReloadRef.current = false;

    let cancelled = false;
    fetchListsIntoState(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [isDragging, mutationGate, fetchListsIntoState]);

  return {
    lists,
    setLists,
    selectedListId,
    setSelectedListId,
    selectedList,
    reload,
    applyLists,
    beginLocalMutation,
    endLocalMutation,
    bumpListsEpoch,
  };
}
