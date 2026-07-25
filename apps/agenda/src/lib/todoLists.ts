import {
  compareTodoTasksByCompletedAtDesc,
  isTodoTaskArchived,
} from '@/lib/todoArchive';

export type TodoListMapped = {
  id: string;
  agendaId: string;
  name: string;
  order: number;
  categories: {
    id: string;
    listId: string;
    name: string;
    order: number;
    tasks: {
      id: string;
      categoryId: string;
      title: string;
      description: string | null;
      completed: boolean;
      completedAt: Date | null;
      order: number;
    }[];
  }[];
};

export function mapTodoList(list: TodoListMapped): TodoListMapped {
  return {
    id: list.id,
    agendaId: list.agendaId,
    name: list.name,
    order: list.order,
    categories: list.categories.map((c) => ({
      id: c.id,
      listId: c.listId,
      name: c.name,
      order: c.order,
      tasks: c.tasks,
    })),
  };
}

export function filterTasksForMainView(
  list: TodoListMapped,
  nowMs: number = Date.now(),
): TodoListMapped {
  return {
    ...list,
    categories: list.categories.map((category) => {
      const active = category.tasks.filter((t) => !t.completed);
      const recentlyCompleted = category.tasks
        .filter((t) => t.completed && !isTodoTaskArchived(t, nowMs))
        .sort(compareTodoTasksByCompletedAtDesc);
      return {
        ...category,
        tasks: [...active, ...recentlyCompleted],
      };
    }),
  };
}

export function filterTasksForArchives(
  list: TodoListMapped,
  nowMs: number = Date.now(),
): TodoListMapped {
  return {
    ...list,
    categories: list.categories
      .map((category) => ({
        ...category,
        tasks: category.tasks
          .filter((t) => isTodoTaskArchived(t, nowMs))
          .sort(compareTodoTasksByCompletedAtDesc),
      }))
      .filter((category) => category.tasks.length > 0),
  };
}

export const todoListInclude = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: {
      tasks: { orderBy: { order: 'asc' as const } },
    },
  },
};
