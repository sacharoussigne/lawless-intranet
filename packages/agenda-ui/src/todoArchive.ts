import dayjs from './dayjs';
import type { AgendaTodoCategoryDTO, AgendaTodoListDTO, AgendaTodoTaskDTO } from './types';

export const TODO_TASK_ARCHIVE_AFTER_MS = 60 * 60 * 1000;

export type TodoTaskArchiveFields = {
  completed: boolean;
  completedAt: Date | string | null;
};

export function getTaskCompletedAtMs(task: TodoTaskArchiveFields): number | null {
  if (!task.completed || !task.completedAt) return null;
  return new Date(task.completedAt).getTime();
}

export function isTodoTaskArchived(
  task: TodoTaskArchiveFields,
  nowMs: number = Date.now(),
): boolean {
  if (!task.completed) return false;

  const completedAtMs = getTaskCompletedAtMs(task);
  if (completedAtMs === null) return true;

  return nowMs - completedAtMs >= TODO_TASK_ARCHIVE_AFTER_MS;
}

export function compareTodoTasksByCompletedAtDesc(
  a: TodoTaskArchiveFields,
  b: TodoTaskArchiveFields,
): number {
  const aTime = getTaskCompletedAtMs(a) ?? 0;
  const bTime = getTaskCompletedAtMs(b) ?? 0;
  return bTime - aTime;
}

export type ArchiveCategorySection = {
  category: AgendaTodoCategoryDTO;
  /** Completion time of the most recent task (0 when unknown). */
  latestMs: number;
  tasks: AgendaTodoTaskDTO[];
};

export type ArchiveListSection = {
  list: AgendaTodoListDTO;
  latestMs: number;
  count: number;
  categories: ArchiveCategorySection[];
};

/** Lowercase without accents: « Été » matches « ete ». */
function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function byLatestThenOrder<T extends { latestMs: number }>(order: (item: T) => number) {
  return (a: T, b: T) => b.latestMs - a.latestMs || order(a) - order(b);
}

/**
 * Archive drawer sections: list > category > tasks, most recently completed
 * first at every level. `listId` null = all lists; `query` searches title and description.
 */
export function buildArchiveSections(
  lists: readonly AgendaTodoListDTO[],
  { listId, query }: { listId: string | null; query: string },
): ArchiveListSection[] {
  const search = normalizeSearch(query.trim());
  const matches = (task: AgendaTodoTaskDTO) =>
    !search || normalizeSearch(`${task.title} ${task.description ?? ''}`).includes(search);

  return lists
    .filter((list) => listId === null || list.id === listId)
    .map((list) => {
      const categories = list.categories
        .map((category) => {
          const tasks = category.tasks.filter(matches).sort(compareTodoTasksByCompletedAtDesc);
          const latestMs = tasks[0] ? (getTaskCompletedAtMs(tasks[0]) ?? 0) : 0;
          return { category, latestMs, tasks };
        })
        .filter((section) => section.tasks.length > 0)
        .sort(byLatestThenOrder((section) => section.category.order));
      return {
        list,
        latestMs: categories[0]?.latestMs ?? 0,
        count: categories.reduce((total, section) => total + section.tasks.length, 0),
        categories,
      };
    })
    .filter((section) => section.count > 0)
    .sort(byLatestThenOrder((section) => section.list.order));
}

/** Number of archived tasks of a list (for the list filter chips). */
export function countArchivedTasks(list: AgendaTodoListDTO): number {
  return list.categories.reduce((total, category) => total + category.tasks.length, 0);
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * When a task was checked, relative and short, in Paris time. Never shows the
 * year: displayed dates would otherwise clash with the RP calendar.
 */
export function formatArchivedAt(completedAt: Date | string | null, nowMs: number = Date.now()): string {
  if (!completedAt) return 'date inconnue';
  const date = dayjs(completedAt).tz('Europe/Paris');
  const now = dayjs(nowMs).tz('Europe/Paris');
  const elapsedMs = now.valueOf() - date.valueOf();

  if (date.isSame(now, 'day')) {
    const hours = Math.max(1, Math.floor(elapsedMs / HOUR_MS));
    return `il y a ${hours} h`;
  }
  if (date.isSame(now.subtract(1, 'day'), 'day')) return `hier, ${date.format('HH:mm')}`;
  if (elapsedMs < 7 * 24 * HOUR_MS) return date.format('ddd HH:mm');
  return date.format('D MMM');
}

/** Full date for the tooltip of `formatArchivedAt` (still without the year). */
export function formatArchivedAtFull(completedAt: Date | string | null): string {
  return completedAt ? dayjs(completedAt).tz('Europe/Paris').format('dddd D MMMM, HH:mm') : 'Date inconnue';
}
