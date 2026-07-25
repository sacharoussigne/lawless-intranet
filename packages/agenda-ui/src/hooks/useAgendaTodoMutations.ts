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
import type { AgendaTodoListDTO } from '../types';
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
};

function showMutationError(error: unknown, fallback: string) {
  notifications.show({
    title: 'Erreur',
    message: error instanceof Error ? error.message : fallback,
    color: 'danger',
  });
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
      const snapshot = lists;
      const optimisticPatch = {
        completed,
        completedAt: completed ? new Date() : null,
      };
      setLists((prev) => patchTaskInLists(prev, id, optimisticPatch));

      try {
        const result = await actions.updateTodoTask(
          { id, completed },
          mutationMeta,
        );
        const data = runAgendaAction(result);
        if (data) {
          setLists((prev) => patchTaskInLists(prev, id, data));
        }
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Mise à jour impossible');
      }
    },
    [actions, lists, mutationMeta, setLists],
  );

  const handleRenameTask = useCallback(
    async (id: string, title: string) => {
      const snapshot = lists;
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
      }
    },
    [actions, lists, mutationMeta, setLists],
  );

  const handleRenameList = useCallback(
    async (id: string, name: string) => {
      const snapshot = lists;
      setLists((prev) => renameListInLists(prev, id, name));

      try {
        const result = await actions.updateTodoList({ id, name }, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Renommage impossible');
      }
    },
    [actions, lists, mutationMeta, setLists],
  );

  const handleRenameCategory = useCallback(
    async (id: string, name: string) => {
      const snapshot = lists;
      setLists((prev) => renameCategoryInLists(prev, id, name));

      try {
        const result = await actions.updateTodoCategory({ id, name }, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Renommage impossible');
      }
    },
    [actions, lists, mutationMeta, setLists],
  );

  const handleDeleteTask = useCallback(
    async (id: string) => {
      const snapshot = lists;
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
      }
    },
    [actions, archivesOpen, lists, mutationMeta, openArchives, setLists],
  );

  const handleCreateList = useCallback(
    async (name: string) => {
      if (!agendaId) return;
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
      }
    },
    [actions, agendaId, mutationMeta, setLists, setSelectedListId],
  );

  const handleCreateCategory = useCallback(
    async (name: string) => {
      if (!selectedList) return;
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
      }
    },
    [
      actions,
      categoryFilterIds,
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
      }
    },
    [actions, mutationMeta, setLists],
  );

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      const snapshot = lists;
      setLists((prev) => removeCategoryFromLists(prev, id));

      try {
        const result = await actions.deleteTodoCategory(id, mutationMeta);
        runAgendaAction(result);
      } catch (error: unknown) {
        setLists(snapshot);
        showMutationError(error, 'Suppression impossible');
      }
    },
    [actions, lists, mutationMeta, setLists],
  );

  const handleDeleteList = useCallback(
    async (id: string) => {
      const snapshot = lists;
      const snapshotSelectedListId = selectedListId;
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
      }
    },
    [actions, lists, mutationMeta, selectedListId, setLists, setSelectedListId],
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
