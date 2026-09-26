import { describe, expect, it } from 'vitest';
import {
  shouldApplyRemoteLists,
  todoUpdatedAtMatches,
} from './todoListsSync';
import {
  isTodoTaskArchived,
  TODO_TASK_ARCHIVE_AFTER_MS,
} from './todoArchive';
import type { AgendaTodoListDTO } from './types';

describe('shouldApplyRemoteLists', () => {
  it('applies when epoch is unchanged', () => {
    expect(shouldApplyRemoteLists(3, 3)).toBe(true);
  });

  it('ignores stale fetch after a local mutation bumped epoch', () => {
    expect(shouldApplyRemoteLists(3, 4)).toBe(false);
  });
});

describe('todoUpdatedAtMatches', () => {
  it('matches equal ISO timestamps', () => {
    const iso = '2026-06-09T12:00:00.000Z';
    expect(todoUpdatedAtMatches(iso, new Date(iso))).toBe(true);
  });

  it('rejects mismatched timestamps', () => {
    expect(
      todoUpdatedAtMatches(
        '2026-06-09T12:00:00.000Z',
        '2026-06-09T12:00:01.000Z',
      ),
    ).toBe(false);
  });

  it('rejects nullish values', () => {
    expect(todoUpdatedAtMatches(null, '2026-06-09T12:00:00.000Z')).toBe(false);
    expect(todoUpdatedAtMatches('2026-06-09T12:00:00.000Z', null)).toBe(false);
  });
});

describe('archive vs main view after completion', () => {
  const now = Date.parse('2026-06-09T15:00:00.000Z');

  function listWithTask(completedAt: Date | null, completed: boolean): AgendaTodoListDTO {
    return {
      id: 'list-1',
      agendaId: 'agenda-1',
      name: 'Main',
      order: 0,
      categories: [
        {
          id: 'cat-1',
          listId: 'list-1',
          name: 'Cat',
          order: 0,
          tasks: [
            {
              id: 'task-1',
              categoryId: 'cat-1',
              title: 'Do thing',
              description: null,
              completed,
              completedAt,
              order: 0,
              updatedAt: new Date(now),
            },
          ],
        },
      ],
    };
  }

  it('keeps recently completed tasks visible', () => {
    const completedAt = new Date(now - TODO_TASK_ARCHIVE_AFTER_MS + 60_000);
    expect(isTodoTaskArchived({ completed: true, completedAt }, now)).toBe(false);
    const list = listWithTask(completedAt, true);
    const tasks = list.categories[0]!.tasks;
    const visible = tasks.filter(
      (task) => !task.completed || !isTodoTaskArchived(task, now),
    );
    expect(visible).toHaveLength(1);
  });

  it('hides archived completed tasks from the active list', () => {
    const completedAt = new Date(now - TODO_TASK_ARCHIVE_AFTER_MS - 1);
    expect(isTodoTaskArchived({ completed: true, completedAt }, now)).toBe(true);
    const list = listWithTask(completedAt, true);
    const tasks = list.categories[0]!.tasks;
    const visible = tasks.filter(
      (task) => !task.completed || !isTodoTaskArchived(task, now),
    );
    expect(visible).toHaveLength(0);
  });

  it('shows unchecked task again when completed is false', () => {
    const list = listWithTask(null, false);
    const tasks = list.categories[0]!.tasks;
    const visible = tasks.filter(
      (task) => !task.completed || !isTodoTaskArchived(task, now),
    );
    expect(visible).toHaveLength(1);
    expect(visible[0]?.completed).toBe(false);
  });
});
