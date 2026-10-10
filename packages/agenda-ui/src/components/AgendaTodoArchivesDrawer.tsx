'use client';

import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Center,
  Collapse,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArchive,
  IconArrowBackUp,
  IconChevronRight,
  IconCircleCheck,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import classes from '../agenda.module.scss';
import {
  buildArchiveSections,
  countArchivedTasks,
  formatArchivedAt,
  formatArchivedAtFull,
  type ArchiveCategorySection,
} from '../todoArchive';
import type { AgendaTodoListDTO, AgendaTodoTaskDTO } from '../types';

interface AgendaTodoArchivesDrawerProps {
  opened: boolean;
  onClose: () => void;
  lists: AgendaTodoListDTO[];
  canWrite: boolean;
  onDeleteTask: (id: string) => void;
  onRestoreTask: (id: string) => void;
  isPending: (key: string) => boolean;
}

type TaskActions = Pick<AgendaTodoArchivesDrawerProps, 'canWrite' | 'onDeleteTask' | 'onRestoreTask' | 'isPending'>;

export function AgendaTodoArchivesDrawer({ opened, onClose, lists, ...actions }: AgendaTodoArchivesDrawerProps) {
  const total = lists.reduce((sum, list) => sum + countArchivedTasks(list), 0);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Stack gap={2}>
          <Title order={4} className="disp-display-title">
            Archives
          </Title>
          <Text size="xs" c="dimmed" fw={400}>
            {total === 0
              ? 'Tâches cochées depuis plus d’une heure.'
              : `${total} tâche${total > 1 ? 's' : ''} terminée${total > 1 ? 's' : ''}, de la plus récente à la plus ancienne.`}
          </Text>
        </Stack>
      }
      position="right"
      size="lg"
    >
      {/* Mounted only while open: filters, search and folded categories reset on each opening. */}
      <ArchivesContent lists={lists} {...actions} />
    </Drawer>
  );
}

function ArchivesContent({ lists, ...actions }: { lists: AgendaTodoListDTO[] } & TaskActions) {
  const [listId, setListId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());

  // A list emptied by a restore or a delete falls back to « Toutes ».
  const activeListId = listId && lists.some((list) => list.id === listId && countArchivedTasks(list) > 0) ? listId : null;
  const sections = useMemo(() => buildArchiveSections(lists, { listId: activeListId, query }), [lists, activeListId, query]);
  const filterLists = useMemo(() => buildArchiveSections(lists, { listId: null, query: '' }), [lists]);

  const toggleFolded = (categoryId: string) =>
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });

  if (filterLists.length === 0) {
    return (
      <Center py={64}>
        <Stack gap={6} align="center">
          <IconArchive size={36} stroke={1.25} color="var(--mantine-color-dimmed)" />
          <Text fw={500}>Aucune tâche archivée</Text>
          <Text size="sm" c="dimmed" ta="center" maw={280}>
            Les tâches cochées depuis plus d’une heure arrivent ici.
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <TextInput
          placeholder="Rechercher dans les archives…"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          leftSection={<IconSearch size={16} stroke={1.5} />}
          rightSection={
            query ? (
              <UnstyledButton aria-label="Effacer la recherche" onClick={() => setQuery('')} className={classes.todoSearchClear}>
                <IconX size={14} stroke={1.5} />
              </UnstyledButton>
            ) : null
          }
          size="sm"
        />
        {filterLists.length > 1 && (
          <div className={classes.todoCategoryFilters} role="group" aria-label="Filtrer par liste">
            <UnstyledButton
              className={`${classes.todoCategoryFilterChip} ${activeListId === null ? classes.todoCategoryFilterChipActive : ''}`}
              onClick={() => setListId(null)}
            >
              Toutes
            </UnstyledButton>
            {filterLists.map(({ list, count }) => (
              <UnstyledButton
                key={list.id}
                className={`${classes.todoCategoryFilterChip} ${activeListId === list.id ? classes.todoCategoryFilterChipActive : ''}`}
                onClick={() => setListId(list.id)}
              >
                {list.name} <span className={classes.archiveChipCount}>{count}</span>
              </UnstyledButton>
            ))}
          </div>
        )}
      </Stack>

      {sections.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Aucun résultat pour « {query.trim()} ».
        </Text>
      ) : (
        sections.map((section) => (
          <section key={section.list.id} className={classes.archiveList}>
            {/* The list name is redundant when a single list is shown. */}
            {sections.length > 1 || filterLists.length > 1 ? (
              <Group justify="space-between" wrap="nowrap" className={classes.archiveListHeader}>
                <Text className={classes.archiveListName} truncate="end">
                  {section.list.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {section.count} tâche{section.count > 1 ? 's' : ''}
                </Text>
              </Group>
            ) : null}
            <Stack gap={6}>
              {section.categories.map((categorySection) => (
                <ArchiveCategory
                  key={categorySection.category.id}
                  section={categorySection}
                  // A search unfolds everything so that no match is hidden.
                  opened={query.trim() !== '' || !folded.has(categorySection.category.id)}
                  onToggle={() => toggleFolded(categorySection.category.id)}
                  {...actions}
                />
              ))}
            </Stack>
          </section>
        ))
      )}
    </Stack>
  );
}

function ArchiveCategory({
  section,
  opened,
  onToggle,
  ...actions
}: { section: ArchiveCategorySection; opened: boolean; onToggle: () => void } & TaskActions) {
  return (
    <div className={classes.archiveCategory}>
      <UnstyledButton className={classes.archiveCategoryHeader} onClick={onToggle} aria-expanded={opened}>
        <Group gap="xs" wrap="nowrap">
          <IconChevronRight
            size={14}
            stroke={1.75}
            className={classes.archiveChevron}
            data-opened={opened || undefined}
          />
          <Text size="sm" fw={600} truncate="end" style={{ flex: 1, minWidth: 0 }}>
            {section.category.name}
          </Text>
          <Badge size="sm" variant="light" color="sage" radius="sm">
            {section.tasks.length}
          </Badge>
        </Group>
      </UnstyledButton>
      <Collapse in={opened}>
        <div className={classes.archiveTasks}>
          {section.tasks.map((task) => (
            <ArchiveTask key={task.id} task={task} {...actions} />
          ))}
        </div>
      </Collapse>
    </div>
  );
}

function ArchiveTask({ task, canWrite, onDeleteTask, onRestoreTask, isPending }: { task: AgendaTodoTaskDTO } & TaskActions) {
  const pending = isPending(`task:${task.id}`);
  return (
    <div className={classes.archiveTask} data-pending={pending || undefined} data-todo-task-id={task.id}>
      <IconCircleCheck size={16} stroke={1.5} className={classes.archiveTaskIcon} />
      <div className={classes.archiveTaskBody}>
        <Text size="sm" className={classes.archiveTaskTitle}>
          {task.title}
        </Text>
        {task.description ? (
          <Text size="xs" c="dimmed" truncate="end">
            {task.description}
          </Text>
        ) : null}
      </div>
      <Tooltip label={formatArchivedAtFull(task.completedAt)} withinPortal openDelay={300}>
        <Text size="xs" c="dimmed" className={classes.archiveTaskDate}>
          {formatArchivedAt(task.completedAt)}
        </Text>
      </Tooltip>
      {canWrite && (
        <Group gap={2} wrap="nowrap" className={classes.archiveTaskActions}>
          <Tooltip label="Restaurer (décocher)" withinPortal>
            <ActionIcon
              variant="subtle"
              color="sage"
              size="sm"
              aria-label={`Restaurer « ${task.title} »`}
              onClick={() => onRestoreTask(task.id)}
              loading={pending}
              disabled={pending}
            >
              <IconArrowBackUp size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Supprimer" withinPortal>
            <ActionIcon
              variant="subtle"
              color="danger"
              size="sm"
              aria-label={`Supprimer « ${task.title} »`}
              onClick={() => onDeleteTask(task.id)}
              disabled={pending}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
    </div>
  );
}
