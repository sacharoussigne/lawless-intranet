import { describe, expect, it } from 'vitest';
import {
  buildArchiveSections,
  formatArchivedAt,
  isTodoTaskArchived,
  TODO_TASK_ARCHIVE_AFTER_MS,
} from './todoArchive';
import type { AgendaTodoCategoryDTO, AgendaTodoListDTO, AgendaTodoTaskDTO } from './types';

describe('isTodoTaskArchived', () => {
  const now = Date.parse('2026-06-09T15:00:00.000Z');

  it('returns false for active tasks', () => {
    expect(
      isTodoTaskArchived({ completed: false, completedAt: null }, now),
    ).toBe(false);
  });

  it('returns false when completed less than one hour ago', () => {
    expect(
      isTodoTaskArchived(
        {
          completed: true,
          completedAt: new Date(now - TODO_TASK_ARCHIVE_AFTER_MS + 60_000),
        },
        now,
      ),
    ).toBe(false);
  });

  it('returns true when completed more than one hour ago', () => {
    expect(
      isTodoTaskArchived(
        {
          completed: true,
          completedAt: new Date(now - TODO_TASK_ARCHIVE_AFTER_MS - 1),
        },
        now,
      ),
    ).toBe(true);
  });

  it('archives legacy completed tasks without completedAt', () => {
    expect(
      isTodoTaskArchived({ completed: true, completedAt: null }, now),
    ).toBe(true);
  });
});

function task(id: string, completedAt: string | null, extra: Partial<AgendaTodoTaskDTO> = {}): AgendaTodoTaskDTO {
  return {
    id,
    categoryId: 'c',
    title: id,
    description: null,
    completed: true,
    completedAt: completedAt ? new Date(completedAt) : null,
    order: 0,
    updatedAt: null,
    ...extra,
  };
}

function list(id: string, order: number, categories: AgendaTodoCategoryDTO[]): AgendaTodoListDTO {
  return { id, agendaId: 'a', name: id, order, categories };
}

function category(id: string, order: number, tasks: AgendaTodoTaskDTO[]): AgendaTodoCategoryDTO {
  return { id, listId: 'l', name: id, order, tasks };
}

describe('buildArchiveSections', () => {
  const lists = [
    list('courses', 0, [
      category('pharmacie', 0, [task('old', '2026-06-01T10:00:00Z'), task('recent', '2026-06-08T10:00:00Z')]),
      category('herbes', 1, [task('newest', '2026-06-09T10:00:00Z', { title: 'Récolter l’Été' })]),
    ]),
    list('cabinet', 1, [category('consult', 0, [task('mid', '2026-06-05T10:00:00Z')])]),
  ];

  it('orders lists, categories and tasks by most recent completion', () => {
    const sections = buildArchiveSections(lists, { listId: null, query: '' });
    expect(sections.map((s) => s.list.id)).toEqual(['courses', 'cabinet']);
    expect(sections[0]?.categories.map((c) => c.category.id)).toEqual(['herbes', 'pharmacie']);
    expect(sections[0]?.categories[1]?.tasks.map((t) => t.id)).toEqual(['recent', 'old']);
    expect(sections[0]?.count).toBe(3);
  });

  it('filters by list', () => {
    expect(buildArchiveSections(lists, { listId: 'cabinet', query: '' }).map((s) => s.list.id)).toEqual(['cabinet']);
  });

  it('searches without accents and drops empty sections', () => {
    const sections = buildArchiveSections(lists, { listId: null, query: '  ete ' });
    expect(sections).toHaveLength(1);
    expect(sections[0]?.categories.map((c) => c.category.id)).toEqual(['herbes']);
    expect(buildArchiveSections(lists, { listId: null, query: 'introuvable' })).toEqual([]);
  });
});

describe('formatArchivedAt', () => {
  // Tuesday 9 June 2026, 17:00 in Paris.
  const now = Date.parse('2026-06-09T15:00:00.000Z');

  it('formats relative to now, without the year', () => {
    expect(formatArchivedAt('2026-06-09T12:00:00.000Z', now)).toBe('il y a 3 h');
    expect(formatArchivedAt('2026-06-08T16:04:00.000Z', now)).toBe('hier, 18:04');
    expect(formatArchivedAt('2026-06-06T12:32:00.000Z', now)).toBe('sam. 14:32');
    expect(formatArchivedAt('2026-05-12T12:00:00.000Z', now)).toBe('12 mai');
    expect(formatArchivedAt(null, now)).toBe('date inconnue');
  });
});
