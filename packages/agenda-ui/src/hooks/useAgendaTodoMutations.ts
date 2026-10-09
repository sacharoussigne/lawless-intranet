'use client';

import { useCallback } from 'react';
import { useAgendaUi } from '../AgendaUiProvider';
import { runAgendaAction } from '../runAgendaAction';
import type { AgendaMutationMeta } from '../realtime/mutationMeta';
import {
  addCategoryToLists,
  addListToLists,
  insertTaskInLists,
  patchTaskInLists,
  removeCategoryFromLists,
  removeListFromLists,
  removeTaskFromLists,
  renameCategoryInLists,
  renameListInLists,
} from '../todoListState';
import type { AgendaTodoListDTO, AgendaTodoTaskDTO } from '../types';
import { notifications } from '@mantine/notifications';
import type { Dispatch, SetStateAction } from 'react';

type UseAgendaTodoMutationsOptions = {
  agendaId: string | null;
  lists: AgendaTodoListDTO[];
  setLists: Dispatch<SetStateAction<AgendaTodoListDTO[]>>;
  setSelectedListId: Dispatch<SetStateAction<string | null>>;
  selectedListId: string | null;
  selectedList: AgendaTodoListDTO | null;
  mutationMeta: AgendaMutationMeta | undefined;
  archivesOpen: boolean;
  archiveLists: AgendaTodoListDTO[];
  setArchiveLists: Dispatch<SetStateAction<AgendaTodoListDTO[]>>;
  setArchivesOpen: Dispatch<SetStateAction<boolean>>;
  isCategoryFilterActive: boolean;
  categoryFilterIds: Set<string>;
  setCategoryFilterIds: Dispatch<SetStateAction<Set<string>>>;
  persistCategoryFilter: (next: Set<string>) => void;
  beginLocalMutation: (key: string) => void;
  endLocalMutation: (key: string) => void;
  reload: () => Promise<void>;
};

function showMutationError(error: unknown, fallback: string) {
  notifications.show({
    title: 'Erreur',
    message: error instanceof Error ? error.message : fallback,
    color: 'danger',
  });
}

function findTaskInLists(
  lists: AgendaTodoListDTO[],
  taskId: string,
): AgendaTodoTaskDTO | null {
  for (const list of lists) {
    for (const category of list.categories) {
      const task = category.tasks.find((entry) => entry.id === taskId);
      if (task) return task;
    }
  }
  return null;
}

function toExpectedUpdatedAt(task: AgendaTodoTaskDTO | null): string | undefined {
  if (!task?.updatedAt) return undefined;
  // Tolerates dates still serialized as strings.
  return new Date(task.updatedAt).toISOString();
}

export function useAgendaTodoMutations({
  agendaId,
  lists,
  setLists,
  setSelectedListId,
  selectedListId,
  selectedList,
  mutationMeta,
  archivesOpen,
  archiveLists,
  setArchiveLists,
  setArchivesOpen,
  isCategoryFilterActive,
  categoryFilterIds,
  setCategoryFilterIds,
  persistCategoryFilter,
  beginLocalMutation,
  endLocalMutation,
  reload,
}: UseAgendaTodoMutationsOptions) {
  const { actions } = useAgendaUi();

  const openArchives = useCallback(async () => {
    if (!agendaId) return;
    try {
      const result = await actions.listTodoLists(agendaId, {
        archives: true,
      });
      const data = runAgendaAction(result);
      if (data) {
        setArchiveLists(data);
        setArchivesOpen(true);
      }
    } catch (error: unknown) {
      showMutationError(error, 'Chargement impossible');
    }
  }, [actions, agendaId, setArchiveLists, setArchivesOpen]);

  const handleToggleTask = useCallback(
    async (id: string, completed: boolean) => {
      const currentTask = findTaskInLists(lists, id);
      const snapshot = lists;
      const optimisticPatch = {
        completed,
        completedAt: completed ? new Date() : null,
      };

      const pendingKey = `task:${id}`;
      beginLocalMutation(pendingKey);
      setLists((prev) => patchTaskInLists(prev, id, optimisticPatch));

      try {
        const result = await actions.updateTodoTask(
          {
            id,
            completed,
            expectedUpdatedAt: toExpectedUpdatedAt(currentTask),
          },
          mutationMeta,
        );
        const data = runAgendaAction(result);
        if (data) {
          setLists((prev) => patchTaskInLists(prev, id, data));
        }
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Mise à jour impossible');
        if (
          error instanceof Error &&
          (error.message.includes('modifiée ailleurs') ||
            error.message.includes('Rechargez'))
        ) {
          await reload();
        }
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [
      actions,
      beginLocalMutation,
      endLocalMutation,
      lists,
      mutationMeta,
      reload,
      setLists,
    ],
  );

  const handleRenameTask = useCallback(
    async (id: string, title: string) => {
      const snapshot = lists;
      const pendingKey = `task:${id}`;
      beginLocalMutation(pendingKey);
      setLists((prev) => patchTaskInLists(prev, id, { title }));

      try {
        const result = await actions.updateTodoTask({ id, title }, mutationMeta);
        const data = runAgendaAction(result);
        if (data) {
          setLists((prev) => patchTaskInLists(prev, id, data));
        }
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Renommage impossible');
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [actions, beginLocalMutation, endLocalMutation, lists, mutationMeta, setLists],
  );

  const handleRenameList = useCallback(
    async (id: string, name: string) => {
      const snapshot = lists;
      const pendingKey = `list:${id}`;
      beginLocalMutation(pendingKey);
      setLists((prev) => renameListInLists(prev, id, name));

      try {
        const result = await actions.updateTodoList({ id, name }, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Renommage impossible');
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [actions, beginLocalMutation, endLocalMutation, lists, mutationMeta, setLists],
  );

  const handleRenameCategory = useCallback(
    async (id: string, name: string) => {
      const snapshot = lists;
      const pendingKey = `category:${id}`;
      beginLocalMutation(pendingKey);
      setLists((prev) => renameCategoryInLists(prev, id, name));

      try {
        const result = await actions.updateTodoCategory({ id, name }, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Renommage impossible');
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [actions, beginLocalMutation, endLocalMutation, lists, mutationMeta, setLists],
  );

  const handleDeleteTask = useCallback(
    async (id: string) => {
      const snapshot = lists;
      const pendingKey = `task:${id}`;
      beginLocalMutation(pendingKey);
      setLists((prev) => removeTaskFromLists(prev, id));

      try {
        const result = await actions.deleteTodoTask(id, mutationMeta);
        runAgendaAction(result);
        if (archivesOpen) {
          await openArchives();
        }
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Suppression impossible');
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [
      actions,
      archivesOpen,
      beginLocalMutation,
      endLocalMutation,
      lists,
      mutationMeta,
      openArchives,
      setLists,
    ],
  );

  /** Unchecks an archived task: it leaves the drawer and is back in the active list. */
  const handleRestoreTask = useCallback(
    async (id: string) => {
      const pendingKey = `task:${id}`;
      beginLocalMutation(pendingKey);
      try {
        // Not optimistic: the row keeps its spinner until the server confirms.
        const result = await actions.updateTodoTask(
          {
            id,
            completed: false,
            expectedUpdatedAt: toExpectedUpdatedAt(findTaskInLists(archiveLists, id)),
          },
          mutationMeta,
        );
        runAgendaAction(result);
        setArchiveLists((prev) => removeTaskFromLists(prev, id));
        await reload();
      } catch (error: unknown) {
        showMutationError(error, 'Restauration impossible');
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [
      actions,
      archiveLists,
      beginLocalMutation,
      endLocalMutation,
      mutationMeta,
      reload,
      setArchiveLists,
    ],
  );

  const handleCreateList = useCallback(
    async (name: string) => {
      if (!agendaId) return false;
      const pendingKey = 'create:list';
      beginLocalMutation(pendingKey);
      try {
        const result = await actions.createTodoList(
          { agendaId, name },
          mutationMeta,
        );
        const data = runAgendaAction(result);
        if (data) {
          setLists((prev) => addListToLists(prev, data));
          setSelectedListId(data.id);
        }
        return true;
      } catch (error: unknown) {
        showMutationError(error, 'Création impossible');
        return false;
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [
      actions,
      agendaId,
      beginLocalMutation,
      endLocalMutation,
      mutationMeta,
      setLists,
      setSelectedListId,
    ],
  );

  const handleCreateCategory = useCallback(
    async (name: string) => {
      if (!selectedList) return false;
      const pendingKey = `create:category:${selectedList.id}`;
      beginLocalMutation(pendingKey);
      try {
        const result = await actions.createTodoCategory(
          { listId: selectedList.id, name },
          mutationMeta,
        );
        const category = runAgendaAction(result);
        if (category) {
          const categoryDto: AgendaTodoListDTO['categories'][number] = {
            id: category.id,
            listId: category.listId,
            name: category.name,
            order: category.order,
            tasks: category.tasks,
          };
          setLists((prev) => addCategoryToLists(prev, selectedList.id, categoryDto));
          if (isCategoryFilterActive) {
            const next = new Set(categoryFilterIds);
            next.add(category.id);
            setCategoryFilterIds(next);
            persistCategoryFilter(next);
          }
        }
        return true;
      } catch (error: unknown) {
        showMutationError(error, 'Création impossible');
        return false;
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [
      actions,
      beginLocalMutation,
      categoryFilterIds,
      endLocalMutation,
      isCategoryFilterActive,
      mutationMeta,
      persistCategoryFilter,
      selectedList,
      setCategoryFilterIds,
      setLists,
    ],
  );

  const handleAddTask = useCallback(
    async (categoryId: string, title: string) => {
      const pendingKey = `create:task:${categoryId}`;
      beginLocalMutation(pendingKey);
      try {
        const result = await actions.createTodoTask(
          { categoryId, title },
          mutationMeta,
        );
        const data = runAgendaAction(result);
        if (data) {
          setLists((prev) => insertTaskInLists(prev, categoryId, data));
        }
        return true;
      } catch (error: unknown) {
        showMutationError(error, 'Ajout impossible');
        return false;
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [actions, beginLocalMutation, endLocalMutation, mutationMeta, setLists],
  );

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      const snapshot = lists;
      const pendingKey = `category:${id}`;
      beginLocalMutation(pendingKey);
      setLists((prev) => removeCategoryFromLists(prev, id));

      try {
        const result = await actions.deleteTodoCategory(id, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Suppression impossible');
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [actions, beginLocalMutation, endLocalMutation, lists, mutationMeta, setLists],
  );

  const handleDeleteList = useCallback(
    async (id: string) => {
      const snapshot = lists;
      const snapshotSelectedListId = selectedListId;
      const pendingKey = `list:${id}`;
      beginLocalMutation(pendingKey);
      setLists((prev) => {
        const next = removeListFromLists(prev, id);
        setSelectedListId((current) =>
          current === id ? (next[0]?.id ?? null) : current,
        );
        return next;
      });

      try {
        const result = await actions.deleteTodoList(id, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        setSelectedListId(snapshotSelectedListId);
        showMutationError(error, 'Suppression impossible');
      } finally {
        endLocalMutation(pendingKey);
      }
    },
    [
      actions,
      beginLocalMutation,
      endLocalMutation,
      lists,
      mutationMeta,
      selectedListId,
      setLists,
      setSelectedListId,
    ],
  );

  return {
    openArchives,
    handleToggleTask,
    handleRenameTask,
    handleRenameList,
    handleRenameCategory,
    handleDeleteTask,
    handleRestoreTask,
    handleCreateList,
    handleCreateCategory,
    handleAddTask,
    handleDeleteCategory,
    handleDeleteList,
  };
}
