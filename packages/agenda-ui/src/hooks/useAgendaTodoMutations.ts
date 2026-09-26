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
  setArchiveLists: Dispatch<SetStateAction<AgendaTodoListDTO[]>>;
  setArchivesOpen: Dispatch<SetStateAction<boolean>>;
  isCategoryFilterActive: boolean;
  categoryFilterIds: Set<string>;
  setCategoryFilterIds: Dispatch<SetStateAction<Set<string>>>;
  persistCategoryFilter: (next: Set<string>) => void;
  beginLocalMutation: () => void;
  endLocalMutation: () => void;
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
  return task.updatedAt.toISOString();
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

      beginLocalMutation();
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
        endLocalMutation();
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
      beginLocalMutation();
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
        endLocalMutation();
      }
    },
    [actions, beginLocalMutation, endLocalMutation, lists, mutationMeta, setLists],
  );

  const handleRenameList = useCallback(
    async (id: string, name: string) => {
      const snapshot = lists;
      beginLocalMutation();
      setLists((prev) => renameListInLists(prev, id, name));

      try {
        const result = await actions.updateTodoList({ id, name }, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Renommage impossible');
      } finally {
        endLocalMutation();
      }
    },
    [actions, beginLocalMutation, endLocalMutation, lists, mutationMeta, setLists],
  );

  const handleRenameCategory = useCallback(
    async (id: string, name: string) => {
      const snapshot = lists;
      beginLocalMutation();
      setLists((prev) => renameCategoryInLists(prev, id, name));

      try {
        const result = await actions.updateTodoCategory({ id, name }, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Renommage impossible');
      } finally {
        endLocalMutation();
      }
    },
    [actions, beginLocalMutation, endLocalMutation, lists, mutationMeta, setLists],
  );

  const handleDeleteTask = useCallback(
    async (id: string) => {
      const snapshot = lists;
      beginLocalMutation();
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
        endLocalMutation();
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

  const handleCreateList = useCallback(
    async (name: string) => {
      if (!agendaId) return;
      beginLocalMutation();
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
      } catch (error: unknown) {
        showMutationError(error, 'Création impossible');
      } finally {
        endLocalMutation();
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
      if (!selectedList) return;
      beginLocalMutation();
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
      } catch (error: unknown) {
        showMutationError(error, 'Création impossible');
      } finally {
        endLocalMutation();
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
      beginLocalMutation();
      try {
        const result = await actions.createTodoTask(
          { categoryId, title },
          mutationMeta,
        );
        const data = runAgendaAction(result);
        if (data) {
          setLists((prev) => insertTaskInLists(prev, categoryId, data));
        }
      } catch (error: unknown) {
        showMutationError(error, 'Ajout impossible');
      } finally {
        endLocalMutation();
      }
    },
    [actions, beginLocalMutation, endLocalMutation, mutationMeta, setLists],
  );

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      const snapshot = lists;
      beginLocalMutation();
      setLists((prev) => removeCategoryFromLists(prev, id));

      try {
        const result = await actions.deleteTodoCategory(id, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Suppression impossible');
      } finally {
        endLocalMutation();
      }
    },
    [actions, beginLocalMutation, endLocalMutation, lists, mutationMeta, setLists],
  );

  const handleDeleteList = useCallback(
    async (id: string) => {
      const snapshot = lists;
      const snapshotSelectedListId = selectedListId;
      beginLocalMutation();
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
        endLocalMutation();
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
    handleCreateList,
    handleCreateCategory,
    handleAddTask,
    handleDeleteCategory,
    handleDeleteList,
  };
}
